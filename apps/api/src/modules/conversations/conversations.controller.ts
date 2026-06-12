import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  AuthContext,
  CurrentAuth,
  JwtAuthGuard,
} from '../tenancy/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

@Controller('agents/:agentId')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  /** Playground ask (F5) — walking skeleton-এর শেষ ধাপ: প্রশ্ন → grounded উত্তর */
  @Post('ask')
  ask(
    @CurrentAuth() auth: AuthContext,
    @Param('agentId') agentId: string,
    @Body() body: { question?: string; conversationId?: string },
  ) {
    return this.conversations.ask(auth.orgId, agentId, body);
  }

  @Get('unknown-questions')
  unknownQuestions(
    @CurrentAuth() auth: AuthContext,
    @Param('agentId') agentId: string,
  ) {
    return this.conversations.unknownQuestions(auth.orgId, agentId);
  }
}
