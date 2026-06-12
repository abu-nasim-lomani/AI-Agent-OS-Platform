import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './auth.service';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

/**
 * Tenant resolution-এর একমাত্র উৎস (docs/02 §4):
 * orgId আসে verified JWT claim থেকে — URL/body/header-এর tenant id কখনো বিশ্বাস নয়।
 * Handler-রা CurrentAuth().orgId → DatabaseService.withOrg() — এই শৃঙ্খলেই RLS দাঁড়িয়ে।
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('missing bearer token');
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      req.auth = {
        userId: payload.sub,
        orgId: payload.org,
        role: payload.role,
      } satisfies AuthContext;
      return true;
    } catch {
      throw new UnauthorizedException('invalid token');
    }
  }
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext =>
    context.switchToHttp().getRequest().auth,
);
