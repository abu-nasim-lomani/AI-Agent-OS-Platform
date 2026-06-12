import { Module } from '@nestjs/common';

/**
 * Agents — agent CRUD, persona config, versions (docs/04 §2, docs/09 F2)।
 *
 * TODO(S0-04): POST/GET /v1/agents — Phase 0: প্রতি org-এ ১টি (F2.1, API-তে enforce)
 * TODO(S0-08): agent config cache (Redis, TTL + invalidation) — প্রতি message-এ DB hit নয় (docs/02 §3.4)
 */
@Module({})
export class AgentsModule {}
