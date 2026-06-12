import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Tenancy — Org / Workspace / User / Membership / Auth (docs/02 §2, docs/09 F1)।
 * Auth v0 (S0-05): signup → org bootstrap, login → JWT, JwtAuthGuard।
 * TODO(পরের sprint): email verification (F1.1), Google OAuth, invite (F1.3)
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class TenancyModule {}
