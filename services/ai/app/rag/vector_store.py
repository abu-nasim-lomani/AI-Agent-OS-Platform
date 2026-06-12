"""VectorStore interface — migration insurance (docs/05 §4).

pgvector আর Qdrant দুটোই এই interface-এর implementation হবে; migration =
dual-write + backfill + read switch, callers অপরিবর্তিত। Trigger: docs/05 §4।
"""

from dataclasses import dataclass
from typing import Protocol


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

    async def upsert_chunks(self, *, org_id: str, agent_id: str, chunks: list[dict]) -> None: ...

    async def delete_source(self, *, org_id: str, source_id: str) -> None: ...


class PgVectorStore:
    """pgvector implementation (asyncpg)।

    নিয়ম: প্রতিটি query-তে org_id + agent_id filter (cross-agent leak রোধ — docs/03 §6.2)
    এবং transaction-এ SET LOCAL app.current_org_id (RLS — Core API-র মতোই)।
    TODO(S0-07): implement; HNSW index সিদ্ধান্ত S0-14 spike report-এর পরে (docs/13 Q4)।
    """

    async def search(self, *, org_id, agent_id, query_vector, k=5):  # type: ignore[override]
        raise NotImplementedError("S0-07")

    async def upsert_chunks(self, *, org_id, agent_id, chunks):  # type: ignore[override]
        raise NotImplementedError("S0-07")

    async def delete_source(self, *, org_id, source_id):  # type: ignore[override]
        raise NotImplementedError("S0-07")
