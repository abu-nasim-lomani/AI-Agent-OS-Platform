import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PLAN_LIMITS, type PlanId } from '@agentos/shared';
import { DatabaseService } from '../../common/database.service';

export interface PersonaConfig {
  tone?: 'professional' | 'friendly' | 'corporate'; // F2.2 — Phase 0-তে ৩টিই
  language?: 'bangla' | 'english' | 'auto';
  welcomeMessage?: string;
}

export interface AgentDto {
  id: string;
  name: string;
  status: string;
  personaConfig: PersonaConfig;
  modelProfile: string;
  createdAt: string;
}

/**
 * Agents CRUD v0 (S0-04, docs/09 F2)।
 * সব query withOrg() পথে — RLS context ছাড়া কোনো row নেই (fail-closed)।
 */
@Injectable()
export class AgentsService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    orgId: string,
    input: { name?: string; personaConfig?: PersonaConfig },
  ): Promise<AgentDto> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name required');

    return this.db.withOrg(orgId, async (client) => {
      // F2.1: plan-অনুযায়ী agent cap — সংখ্যা hard-code নয়, PLAN_LIMITS থেকে (docs/10 §2)
      const org = await client.query(
        'SELECT plan FROM organizations WHERE id = $1',
        [orgId],
      );
      if (!org.rowCount) throw new NotFoundException('organization not found');
      const plan = org.rows[0].plan as PlanId;
      const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial;

      const count = await client.query('SELECT count(*)::int AS n FROM agents');
      if (count.rows[0].n >= limits.agents) {
        throw new ForbiddenException(
          `plan '${plan}' allows ${limits.agents} agent(s)`,
        );
      }

      // F1.5: প্রতি org-এর default workspace — UI-তে invisible, এখানে resolve হয়
      const ws = await client.query(
        'SELECT id FROM workspaces ORDER BY created_at LIMIT 1',
      );
      if (!ws.rowCount) throw new NotFoundException('default workspace missing');

      const res = await client.query(
        `INSERT INTO agents (org_id, workspace_id, name, persona_config)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, status, persona_config, model_profile, created_at`,
        [orgId, ws.rows[0].id, name, JSON.stringify(input.personaConfig ?? {})],
      );
      return toDto(res.rows[0]);
    });
  }

  async list(orgId: string): Promise<AgentDto[]> {
    return this.db.withOrg(orgId, async (client) => {
      const res = await client.query(
        `SELECT id, name, status, persona_config, model_profile, created_at
         FROM agents ORDER BY created_at`,
      );
      return res.rows.map(toDto);
    });
  }

  async get(orgId: string, agentId: string): Promise<AgentDto> {
    return this.db.withOrg(orgId, async (client) => {
      const res = await client.query(
        `SELECT id, name, status, persona_config, model_profile, created_at
         FROM agents WHERE id = $1`,
        [agentId],
      );
      if (!res.rowCount) throw new NotFoundException('agent not found');
      return toDto(res.rows[0]);
    });
  }

  /** Persona/name update (F2.2 wizard step ②)। Status transitions পরের ticket-এ। */
  async update(
    orgId: string,
    agentId: string,
    input: { name?: string; personaConfig?: PersonaConfig },
  ): Promise<AgentDto> {
    return this.db.withOrg(orgId, async (client) => {
      const res = await client.query(
        `UPDATE agents
         SET name = COALESCE($2, name),
             persona_config = COALESCE($3, persona_config)
         WHERE id = $1
         RETURNING id, name, status, persona_config, model_profile, created_at`,
        [
          agentId,
          input.name?.trim() || null,
          input.personaConfig ? JSON.stringify(input.personaConfig) : null,
        ],
      );
      if (!res.rowCount) throw new NotFoundException('agent not found');
      return toDto(res.rows[0]);
      // TODO(S0-07): meaningful change → agent_versions নতুন row (docs/04 §2)
    });
  }
}

function toDto(row: {
  id: string;
  name: string;
  status: string;
  persona_config: PersonaConfig;
  model_profile: string;
  created_at: Date;
}): AgentDto {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    personaConfig: row.persona_config,
    modelProfile: row.model_profile,
    createdAt: row.created_at.toISOString(),
  };
}
