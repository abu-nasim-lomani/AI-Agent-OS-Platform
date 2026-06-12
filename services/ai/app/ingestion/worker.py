"""Ingestion worker — BullMQ consumer (S0-07).

Core API 'ingestion' queue-তে job দেয় (queue-Redis, A1); এই worker সেগুলো খায়।
চালানো: uv run python -m app.ingestion.worker

Job payload: { "orgId": ..., "agentId": ..., "sourceId": ... }
Retry/backoff BullMQ-র — job fail হলে pipeline status='failed' set করেই fail করে,
তাই retry idempotent (hash-diff আবার চললে unchanged সব skip)।
"""

import asyncio
import logging
import signal

from bullmq import Worker

from app.config import settings
from app.ingestion.pipeline import process_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("worker")


async def _process(job, _token):
    data = job.data
    log.info("job %s: source %s", job.id, data.get("sourceId"))
    await process_source(data["orgId"], data["agentId"], data["sourceId"])


async def main() -> None:
    # TODO(S0-07): per-tenant concurrency cap (docs/02 §3.1) — BullMQ group/limiter
    worker = Worker(
        "ingestion",
        _process,
        {"connection": settings.redis_queue_url, "concurrency": 2},
    )
    log.info("ingestion worker started (queue=ingestion, redis=%s)", settings.redis_queue_url)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows
            signal.signal(sig, lambda *_: stop.set())
    await stop.wait()
    await worker.close()
    log.info("worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
