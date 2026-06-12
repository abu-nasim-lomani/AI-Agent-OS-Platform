import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import '@fastify/multipart'; // FastifyRequest.file() type augmentation
import {
  AuthContext,
  CurrentAuth,
  JwtAuthGuard,
} from '../tenancy/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';

@Controller('agents/:agentId/sources')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  /** multipart/form-data, field: file — F3.1: PDF, ≤25MB (limit main.ts-এ) */
  @Post()
  async upload(
    @CurrentAuth() auth: AuthContext,
    @Param('agentId') agentId: string,
    @Req() req: FastifyRequest,
  ) {
    const file = await req.file();
    if (!file) throw new BadRequestException('file field required (multipart)');
    if (file.mimetype !== 'application/pdf')
      throw new BadRequestException('Phase 0: only PDF supported (docs/09 F3)');

    const data = await file.toBuffer();
    return this.knowledge.uploadPdf(auth.orgId, agentId, file.filename, data);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext, @Param('agentId') agentId: string) {
    return this.knowledge.list(auth.orgId, agentId);
  }
}
