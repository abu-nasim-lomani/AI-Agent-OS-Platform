import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

/**
 * Tenant-scoped DB access — RLS-এর entry point (docs/03 §2.2, docs/13 Q2)।
 *
 * নিয়মগুলো এখানে কেন্দ্রীভূত, অন্য কোথাও SET লেখা নিষেধ:
 *  1. সব tenant query withOrg() দিয়ে — SET LOCAL transaction-scoped,
 *     তাই pooled connection-এ context leak হয় না (Q2 ফাঁদ #1)।
 *  2. App role (agentos_app) — BYPASSRLS নেই; ভুলে WHERE org_id বাদ গেলেও
 *     DB অন্য tenant-এর row দেখাবে না।
 *  3. Production-এ PgBouncer transaction-mode — এই pattern তার সাথে compatible।
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  /** Tenant context-সহ একটি transaction চালায়। সব tenant-scoped কাজ এই পথে। */
  async withOrg<T>(
    orgId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // set_config + parameter — string interpolation নয় (injection-safe)
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [
        orgId,
      ]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // TODO(S0-05): withoutTenant() — শুধু auth bootstrap path-এর জন্য
  // (user lookup, org create) — আলাদা সীমিত-grant role দিয়ে, কখনো BYPASSRLS নয়।

  onModuleDestroy() {
    return this.pool.end();
  }
}
