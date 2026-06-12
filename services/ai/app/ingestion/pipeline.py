"""Ingestion pipeline — docs/04 §3-এর flowchart কোডে (S0-07).

Parse → Chunk → Hash-diff → Embed (নতুন/বদলানো শুধু) → Index → status update।
Walking skeleton: pypdf basic extraction; layout-aware parsing (F3.2) পরের sprint।
"""

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from io import BytesIO

import boto3
from pypdf import PdfReader

from app.config import settings
from app.db import org_tx
from app.gateway import llm_gateway
from app.rag.vector_store import PgVectorStore

log = logging.getLogger("ingestion")

CHUNK_CHARS = 1200  # ~300 token; heading-aware semantic chunking পরের sprint
EMBED_BATCH = 64

vector_store = PgVectorStore()


@dataclass
class ParsedChunk:
    content: str
    page: int | None

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.encode()).hexdigest()


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
    )


def _parse_pdf(data: bytes) -> list[ParsedChunk]:
    """Per-page extraction → paragraph-boundary split (≤ CHUNK_CHARS)।"""
    reader = PdfReader(BytesIO(data))
    chunks: list[ParsedChunk] = []
    for page_no, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue  # scanned page — F3.6 reject logic Core API-তে; এখানে নীরবে skip নয়, নিচে গণনা
        buf = ""
        for para in text.split("\n\n"):
            if buf and len(buf) + len(para) > CHUNK_CHARS:
                chunks.append(ParsedChunk(content=buf.strip(), page=page_no))
                buf = para
            else:
                buf = f"{buf}\n\n{para}" if buf else para
        if buf.strip():
            chunks.append(ParsedChunk(content=buf.strip(), page=page_no))
    return chunks


async def _set_status(org_id: str, source_id: str, status: str, error: str | None = None):
    async with org_tx(org_id) as conn:
        await conn.execute(
            "UPDATE knowledge_sources SET status = $2, error = $3 WHERE id = $1",
            source_id,
            status,
            error,
        )


async def process_source(org_id: str, agent_id: str, source_id: str) -> None:
    """এক source-এর সম্পূর্ণ ingestion। Fail হলে status='failed' + error — Agent অক্ষত (F4.5)।"""
    try:
        await _set_status(org_id, source_id, "processing")

        # 1. Fetch (boto3 sync → thread, event loop block নয়)
        async with org_tx(org_id) as conn:
            row = await conn.fetchrow(
                "SELECT s3_key, type FROM knowledge_sources WHERE id = $1", source_id
            )
        if row is None:
            raise RuntimeError("source not found")
        data = await asyncio.to_thread(
            lambda: _s3().get_object(Bucket=settings.s3_bucket, Key=row["s3_key"])["Body"].read()
        )

        # 2. Parse + chunk
        parsed = await asyncio.to_thread(_parse_pdf, data)
        if not parsed:
            raise RuntimeError("no extractable text (scanned PDF? — F3.6)")

        # 3. Hash-diff — Smart Retraining-এর হৃৎপিণ্ড (docs/04 §4)
        existing = await vector_store.existing_hashes(org_id=org_id, source_id=source_id)
        fresh = [c for c in parsed if c.content_hash not in existing]
        keep = [c.content_hash for c in parsed]
        removed = await vector_store.delete_missing(
            org_id=org_id, source_id=source_id, keep_hashes=keep
        )

        # 4. Embed শুধু নতুন/বদলানো — batched
        indexed = 0
        for i in range(0, len(fresh), EMBED_BATCH):
            batch = fresh[i : i + EMBED_BATCH]
            vectors = await llm_gateway.embed([c.content for c in batch])
            indexed += await vector_store.upsert_chunks(
                org_id=org_id,
                agent_id=agent_id,
                source_id=source_id,
                chunks=[
                    {
                        "content": c.content,
                        "content_hash": c.content_hash,
                        "page": c.page,
                        "embedding": v,
                    }
                    for c, v in zip(batch, vectors)
                ],
            )
            # TODO(S0-09): embedding usage → usage_ledger (kind="embedding")

        await _set_status(org_id, source_id, "trained")
        log.info(
            "source %s trained: %d chunks total, %d embedded (diff-skipped %d), %d retired",
            source_id, len(parsed), indexed, len(parsed) - len(fresh), removed,
        )
        # TODO(পরের sprint): agent_versions bump + atomic pointer flip (docs/04 §3)
    except Exception as e:  # noqa: BLE001 — status-এ প্রকাশ, পাইপলাইন মরবে না
        log.exception("ingestion failed for source %s", source_id)
        await _set_status(org_id, source_id, "failed", str(e)[:500])
