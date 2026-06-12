import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AuthContext,
  CurrentAuth,
  JwtAuthGuard,
} from '../tenancy/jwt-auth.guard';
import { AgentsService, PersonaConfig } from './agents.service';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: { name?: string; personaConfig?: PersonaConfig },
  ) {
    return this.agents.create(auth.orgId, body);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.agents.list(auth.orgId);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.agents.get(auth.orgId, id);
  }

  @Patch(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: { name?: string; personaConfig?: PersonaConfig },
  ) {
    return this.agents.update(auth.orgId, id, body);
  }
}
