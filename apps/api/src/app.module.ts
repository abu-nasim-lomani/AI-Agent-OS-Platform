import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { AgentsModule } from './modules/agents/agents.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { BillingModule } from './modules/billing/billing.module';
import { HealthController } from './health.controller';

/**
 * Modular Monolith — module boundary = docs/02 §2.
 * নিয়ম (docs/02 §1): এক module আরেক module-এর table সরাসরি query করবে না —
 * শুধু exported service interface দিয়ে কথা বলবে। ভবিষ্যতে module = extractable service।
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    TenancyModule,
    AgentsModule,
    KnowledgeModule,
    ConversationsModule,
    ChannelsModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
