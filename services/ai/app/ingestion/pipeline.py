"""Ingestion pipeline — docs/04 §3-এর flowchart কোডে (S0-07).

Queue consumer: Core API BullMQ 'ingestion' queue-তে job দেয় (REDIS_QUEUE_URL),
এই worker সেগুলো খায়। প্রতিটি step আলাদা resumable unit — ৩০০ পাতায় fail হলে
শুরু থেকে নয় (docs/04 §3 নিয়ম #1)।
"""

import hashlib
from dataclasses import dataclass


@dataclass
class ParsedChunk:
    content: str
    page: int | None
    heading: str | None

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.encode()).hexdigest()


async def process_source(org_id: str, agent_id: str, source_id: str) -> None:
    """Parse → Chunk → Hash-diff → Embed (নতুন/বদলানো শুধু) → Index → Version bump.

    TODO(S0-07) ক্রম:
      1. S3 থেকে file → pypdf basic text extraction (layout-aware F3.2 পরের sprint)
      2. heading-aware chunking (page metadata-সহ — citation-এর জন্য)
      3. hash-diff: বিদ্যমান chunks-এর content_hash-এর সাথে তুলনা —
         unchanged → skip (Smart Retraining-এর হৃৎপিণ্ড, docs/04 §4)
      4. llm_gateway.embed(batch) — dimension = vector(1024)
      5. vector_store.upsert_chunks() + মুছে যাওয়া chunk retire
      6. agent_versions নতুন row + active pointer flip (atomic — zero downtime)
      7. knowledge_sources.status = 'trained' (fail হলে 'failed' + error)
    """
    raise NotImplementedError("S0-07")
