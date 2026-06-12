import { Module } from '@nestjs/common';

/**
 * Tenancy — Org / Workspace / User / Membership / Auth (docs/02 §2, docs/09 F1)।
 *
 * TODO(S0-05):
 *  - POST /v1/auth/signup  → user + org + default workspace + owner membership
 *    (org bootstrap: db/migrations/0001-এর SECURITY DEFINER নোট দেখুন)
 *  - POST /v1/auth/login   → JWT { sub: userId, org: orgId, role }
 *  - JwtAuthGuard: token থেকে orgId resolve → request context-এ
 *    (URL/body-র tenant id কখনো বিশ্বাস নয় — docs/02 §4)
 */
@Module({})
export class TenancyModule {}
