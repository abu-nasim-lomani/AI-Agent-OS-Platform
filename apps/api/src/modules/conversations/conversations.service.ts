import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

export interface AskResult {
  conversationId: string;
  kind: 'answer' | 'unknown';
  text: string;
  citations: { sourceName: string; page: number | null }[];
}

const UNKNOWN_FALLBACK =
  'দুঃখিত, এই তথ্যটি এই মুহূর্তে আমার কাছে নেই।'; // F8.5 — honest fallback; contact line config পরে

/**
 * Conversations (S0-08, docs/04 §6–7, docs/09 F5/F8)।
 * Ask path: persist in-message → AI Service /v1/answer → persist out-message;
 * UNKNOWN হলে unknown_questions-এ log (Learning Loop-এর বীজ, F8.3)।
 */
@Injectable()
export class ConversationsService {
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

  constructor(private readonly db: DatabaseService) {}

  async ask(
    orgId: string,
    agentId: string,
    input: { question?: string; conversationId?: string },
  ): Promise<AskResult> {
    const question = input.question?.trim();
    if (!question) throw new BadRequestException('question required');

    // 1. Conversation resolve/create + in-message persist (playground channel — F5.3-এ আলাদা গণনা)
    const { conversationId, modelProfile } = await this.db.withOrg(
      orgId,
      async (client) => {
        const agent = await client.query(
          'SELECT id, model_profile FROM agents WHERE id = $1',
          [agentId],
        );
        if (!agent.rowCount) throw new NotFoundException('agent not found');

        let convId = input.conversationId ?? null;
        if (convId) {
          const conv = await client.query(
            'SELECT id FROM conversations WHERE id = $1 AND agent_id = $2',
            [convId, agentId],
          );
          if (!conv.rowCount) throw new NotFoundException('conversation not found');
        } else {
          const conv = await client.query(
            `INSERT INTO conversations (org_id, agent_id, channel)
             VALUES ($1, $2, 'playground') RETURNING id`,
            [orgId, agentId],
          );
          convId = conv.rows[0].id as string;
        }

        await client.query(
          `INSERT INTO messages (org_id, conversation_id, direction, content)
           VALUES ($1, $2, 'in', $3)`,
          [orgId, convId, JSON.stringify({ type: 'text', body: question })],
        );
        return {
          conversationId: convId,
          modelProfile: agent.rows[0].model_profile as string,
        };
      },
    );

    // 2. AI Service — RAG answer (docs/02 §2-এর sequence)
    let ai: {
      kind: 'answer' | 'unknown';
      text: string;
      citations: { source_name: string; page: number | null }[];
    };
    try {
      const res = await fetch(`${this.aiServiceUrl}/v1/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          agent_id: agentId,
          question,
          profile: modelProfile,
        }),
      });
      if (!res.ok) throw new Error(`ai service ${res.status}`);
      ai = (await res.json()) as typeof ai;
    } catch (e) {
      throw new BadGatewayException(`AI service unavailable: ${String(e)}`);
    }

    const text = ai.kind === 'unknown' ? UNKNOWN_FALLBACK : ai.text;
    const citations = (ai.citations ?? []).map((c) => ({
      sourceName: c.source_name,
      page: c.page,
    }));

    // 3. Out-message persist + UNKNOWN হলে learning-loop log
    await this.db.withOrg(orgId, async (client) => {
      const msg = await client.query(
        `INSERT INTO messages (org_id, conversation_id, direction, content, citations, is_unknown)
         VALUES ($1, $2, 'out', $3, $4, $5) RETURNING id`,
        [
          orgId,
          conversationId,
          JSON.stringify({ type: 'text', body: text }),
          JSON.stringify(citations),
          ai.kind === 'unknown',
        ],
      );
      if (ai.kind === 'unknown') {
        await client.query(
          `INSERT INTO unknown_questions (org_id, agent_id, question, message_id)
           VALUES ($1, $2, $3, $4)`,
          [orgId, agentId, question, msg.rows[0].id],
        );
      }
    });

    return { conversationId, kind: ai.kind, text, citations };
  }

  /** F8.2 — pending unknown questions (Phase 0: raw list; clustering Phase 1) */
  async unknownQuestions(orgId: string, agentId: string) {
    return this.db.withOrg(orgId, async (client) => {
      const res = await client.query(
        `SELECT id, question, status, created_at FROM unknown_questions
         WHERE agent_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 200`,
        [agentId],
      );
      return res.rows.map((r) => ({
        id: r.id,
        question: r.question,
        status: r.status,
        createdAt: r.created_at.toISOString(),
      }));
    });
  }

  // TODO(পরের sprint): conversations list + transcript view (F8.1),
  //   unknown → FAQ answer one-click (F8.3), daily digest (F8.4)
}
