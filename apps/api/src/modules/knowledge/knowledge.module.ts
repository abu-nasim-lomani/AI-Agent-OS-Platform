import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

/**
 * Knowledge — sources, upload, ingestion job dispatch (docs/04 §3, docs/09 F3–F4)।
 * Heavy processing Python worker-এ (services/ai/app/ingestion) — এখানে শুধু দরজা।
 *
 * TODO(পরের sprint): FAQ editor (F3.3), source delete (F3.5),
 *   per-tenant queue concurrency cap (docs/02 §3.1)
 */
@Module({
  imports: [TenancyModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
