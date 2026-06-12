import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/**
 * Conversations — sessions, messages, unknown-question log (docs/04 §6–7, docs/09 F8)।
 * S0-08: ask path (playground) + unknown list।
 *
 * TODO(পরের sprint): transcript view (F8.1), one-click FAQ answer (F8.3),
 *   daily digest (F8.4), channel conversations (widget/messenger)
 */
@Module({
  imports: [TenancyModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
