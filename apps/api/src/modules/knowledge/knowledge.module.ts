import { Module } from '@nestjs/common';

/**
 * Knowledge — sources, upload, ingestion job dispatch (docs/04 §3, docs/09 F3–F4)।
 *
 * TODO(S0-07):
 *  - POST /v1/agents/:id/sources (pdf|faq) → MinIO/S3 put → BullMQ 'ingestion' queue-তে job
 *    (queue = REDIS_QUEUE_URL — cache-Redis নয়! docs/13 A1)
 *  - GET sources + status (F3.4)
 *  - per-tenant queue concurrency cap (docs/02 §3.1)
 */
@Module({})
export class KnowledgeModule {}
