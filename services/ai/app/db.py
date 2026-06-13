"""asyncpg pool + tenant-context transaction — Core API-র withOrg()-এর Python যমজ।

নিয়ম এক (docs/03 §2.2): সব tenant query org_tx() পথে; SET LOCAL transaction-scoped।
"""

from contextlib import asynccontextmanager

import asyncpg
from pgvector.asyncpg import register_vector

from app.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # app_database_url = agentos_app (NOBYPASSRLS); superuser নয় (docs/03 §2.2)
        _pool = await asyncpg.create_pool(
            settings.app_database_url, min_size=1, max_size=10, init=register_vector
        )
    return _pool


@asynccontextmanager
async def org_tx(org_id: str):
    """Tenant-scoped transaction — RLS context set, commit/rollback automatic।"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.current_org_id', $1, true)", org_id
            )
            yield conn
