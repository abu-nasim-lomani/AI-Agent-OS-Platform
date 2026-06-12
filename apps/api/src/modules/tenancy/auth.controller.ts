import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthContext, CurrentAuth, JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Signup → user + org + default workspace + owner membership + JWT (F1.2) */
  @Post('signup')
  signup(
    @Body() body: { email?: string; password?: string; companyName?: string },
  ) {
    return this.auth.signup(body);
  }

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body);
  }

  /** Token sanity check — walking skeleton-এর প্রথম protected endpoint */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentAuth() auth: AuthContext) {
    return auth;
  }
}
