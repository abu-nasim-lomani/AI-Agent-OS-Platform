import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

/**
 * Agents — agent CRUD, persona config, versions (docs/04 §2, docs/09 F2)।
 * Phase 0: প্রতি org-এ ১টি agent (F2.1) — PLAN_LIMITS দিয়ে enforce।
 *
 * TODO(S0-07): training trigger-এ agent_versions + status transitions
 * TODO(S0-08): agent config cache (Redis, TTL + invalidation) — docs/02 §3.4
 */
@Module({
  imports: [TenancyModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
