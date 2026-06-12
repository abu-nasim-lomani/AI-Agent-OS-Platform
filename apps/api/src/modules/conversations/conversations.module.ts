import { Module } from '@nestjs/common';

/**
 * Conversations — sessions, messages, unknown-question log (docs/04 §6–7, docs/09 F8)।
 *
 * TODO(S0-08):
 *  - POST /v1/agents/:id/ask → AI Service /v1/answer call → message persist
 *  - UNKNOWN হলে unknown_questions-এ insert (Learning Loop-এর বীজ — F8.3)
 *  - playground channel analytics/billing-এ গণনা নয় (F5.3)
 */
@Module({})
export class ConversationsModule {}
