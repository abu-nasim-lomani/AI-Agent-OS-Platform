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
  // App সবসময় agentos_app (NOBYPASSRLS) — superuser DATABASE_URL নয়।
  // Superuser RLS bypass করে, তাই app সেটা ব্যবহার করলে isolation নিষ্ক্রিয় হয় (docs/03 §2.2)।
  private readonly pool = new Pool({
    connectionString: process.env.APP_DATABASE_URL,
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

  /**
   * Auth bootstrap path (S0-05) — tenant context-হীন transaction।
   * শুধু users lookup/create ও bootstrap_organization() call-এর জন্য
   * (দুটোই RLS-এর বাইরে নয় — users un-scoped, bootstrap fn নিজের context set করে)।
   * Business data এই পথে query করা নিষেধ — RLS fail-closed: শূন্য row পাবেন।
   */
  async authTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
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

  /**
   * User-context transaction (S0-05) — login-এ নিজের membership পড়ার জন্য
   * (memberships-এর self_membership policy, db/migrations/0002)।
   */
  async withUser<T>(
    userId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.authTx(async (client) => {
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true)",
        [userId],
      );
      return fn(client);
    });
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
