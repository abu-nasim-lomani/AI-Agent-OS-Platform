import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseService } from '../../common/database.service';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export interface AuthResult {
  token: string;
  userId: string;
  orgId: string;
  role: string;
}

export interface JwtPayload {
  sub: string; // userId
  org: string; // orgId — সব tenant query এই claim থেকে (URL/body নয় — docs/02 §4)
  role: string;
}

/**
 * Auth v0 (S0-05, docs/09 F1) — F1-এর সরুতম রূপ:
 * email+password → JWT; signup-এ org auto-create (bootstrap_organization)।
 * TODO(পরের sprint): email verification (F1.1), Google OAuth, member invite (F1.3)
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async signup(input: {
    email?: string;
    password?: string;
    companyName?: string;
  }): Promise<AuthResult> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';
    const companyName = input.companyName?.trim();
    if (!email || !email.includes('@'))
      throw new BadRequestException('valid email required');
    if (password.length < 8)
      throw new BadRequestException('password must be at least 8 characters');
    if (!companyName)
      throw new BadRequestException('companyName required');

    const passwordHash = await this.hashPassword(password);

    return this.db.authTx(async (client) => {
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email],
      );
      if (existing.rowCount) throw new ConflictException('email already registered');

      const user = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash],
      );
      const userId: string = user.rows[0].id;

      // নিয়ন্ত্রিত দরজা — RLS bypass নয় (db/migrations/0002)
      const org = await client.query(
        'SELECT bootstrap_organization($1, $2) AS org_id',
        [companyName, userId],
      );
      const orgId: string = org.rows[0].org_id;

      return this.issue(userId, orgId, 'owner');
    });
  }

  async login(input: { email?: string; password?: string }): Promise<AuthResult> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password)
      throw new UnauthorizedException('invalid credentials');

    const user = await this.db.authTx(async (client) => {
      const res = await client.query(
        'SELECT id, password_hash FROM users WHERE email = $1',
        [email],
      );
      return res.rows[0] as { id: string; password_hash: string | null } | undefined;
    });

    const ok =
      user?.password_hash != null &&
      (await this.verifyPassword(input.password, user.password_hash));
    if (!ok || !user) throw new UnauthorizedException('invalid credentials');

    // নিজের membership — self_membership policy-র পথে (docs/03 §2.2-এর সাথে সঙ্গতিপূর্ণ)
    const membership = await this.db.withUser(user.id, async (client) => {
      const res = await client.query(
        'SELECT org_id, role FROM memberships WHERE user_id = $1 ORDER BY org_id LIMIT 1',
        [user.id],
      );
      return res.rows[0] as { org_id: string; role: string } | undefined;
    });
    if (!membership) throw new UnauthorizedException('no organization membership');

    return this.issue(user.id, membership.org_id, membership.role);
  }

  private issue(userId: string, orgId: string, role: string): AuthResult {
    const payload: JwtPayload = { sub: userId, org: orgId, role };
    return { token: this.jwt.sign(payload), userId, orgId, role };
  }

  // scrypt (node built-in) — v0-তে বাড়তি dependency নয়; format: salt:hash (hex)
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const derived = await scrypt(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
