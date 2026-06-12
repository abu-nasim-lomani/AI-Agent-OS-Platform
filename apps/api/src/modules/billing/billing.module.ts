import { Module } from '@nestjs/common';

/**
 * Billing — plans, usage metering (docs/10, docs/09 F10)।
 *
 * TODO(S0-09): usage_ledger write API (AI Service প্রতি LLM call-এ post করবে)
 * TODO(পরের sprint): cap enforcement (F10.2), daily budget kill-switch (F10.3),
 *   plan config (packages/shared PLAN_LIMITS থেকে)
 */
@Module({})
export class BillingModule {}
