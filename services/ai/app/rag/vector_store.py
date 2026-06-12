"""VectorStore interface — migration insurance (docs/05 §4).

pgvector আর Qdrant দুটোই এই interface-এর implementation হবে; migration =
dual-write + backfill + read switch, callers অপরিবর্তিত। Trigger: docs/05 §4।
"""

from dataclasses import dataclass
from typing import Any, Protocol

from pgvector import Vector

from app.db import org_tx


@dataclass
class ChunkHit:
    chunk_id: str
    content: str
    score: float
    source_name: str
    page: int | None


class VectorStore(Protocol):
    async def search(
        self, *, org_id: str, agent_id: str, query_vector: list[float], k: int = 5
    ) -> list[ChunkHit]: ...

    async def upsert_chunks(
        self, *, org_id: str, agent_id: str, source_id: str, chunks: list[dict[str, Any]]
    ) -> int: ...

    async def delete_missing(
        self, *, org_id: str, source_id: str, keep_hashes: list[str]
    ) -> int: ...


class PgVectorStore:
    """pgvector implementation (S0-07)।

    নিয়ম: প্রতিটি query org_tx() (RLS) + agent_id filter (cross-agent leak — docs/03 §6.2)।
    HNSW index সিদ্ধান্ত S0-14 spike-এর পরে (docs/13 Q4) — এখন exact scan।
    """

    async def search(self, *, org_id, agent_id, query_vector, k=5):
        async with org_tx(org_id) as conn:
            rows = await conn.fetch(
                """
                SELECT c.id, c.content, c.page, ks.name AS source_name,
                       1 - (c.embedding <=> $1) AS score
                FROM chunks c
                JOIN knowledge_sources ks ON ks.id = c.source_id
                WHERE c.agent_id = $2 AND c.embedding IS NOT NULL
                ORDER BY c.embedding <=> $1
                LIMIT $3
                """,
                Vector(query_vector),
                agent_id,
                k,
            )
        return [
            ChunkHit(
                chunk_id=str(r["id"]),
                content=r["content"],
                score=float(r["score"]),
                source_name=r["source_name"],
                page=r["page"],
            )
            for r in rows
        ]

    async def upsert_chunks(self, *, org_id, agent_id, source_id, chunks):
        """নতুন/পরিবর্তিত chunk insert। Hash-diff caller (pipeline) করে — এখানে শুধু লেখা।"""
        if not chunks:
            return 0
        async with org_tx(org_id) as conn:
            await conn.executemany(
                """
                INSERT INTO chunks
                  (org_id, agent_id, source_id, content, content_hash, page, heading, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                [
                    (
                        org_id,
                        agent_id,
                        source_id,
                        c["content"],
                        c["content_hash"],
                        c.get("page"),
                        c.get("heading"),
                        Vector(c["embedding"]),
                    )
                    for c in chunks
                ],
            )
        return len(chunks)

    async def existing_hashes(self, *, org_id: str, source_id: str) -> set[str]:
        async with org_tx(org_id) as conn:
            rows = await conn.fetch(
                "SELECT content_hash FROM chunks WHERE source_id = $1", source_id
            )
        return {r["content_hash"] for r in rows}

    async def delete_missing(self, *, org_id, source_id, keep_hashes):
        """মুছে যাওয়া content-এর chunk retire (docs/04 §4)।"""
        async with org_tx(org_id) as conn:
            result = await conn.execute(
                "DELETE FROM chunks WHERE source_id = $1 AND NOT (content_hash = ANY($2::text[]))",
                source_id,
                keep_hashes,
            )
        return int(result.split()[-1])
