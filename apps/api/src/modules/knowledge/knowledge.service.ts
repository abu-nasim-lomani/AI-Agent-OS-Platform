import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../common/database.service';

export interface SourceDto {
  id: string;
  type: string;
  name: string;
  status: string;
  error: string | null;
  createdAt: string;
}

/**
 * Knowledge — upload → S3 → ingestion queue (S0-07, docs/04 §3, docs/09 F3–F4)।
 * Processing এখানে হয় না — শুধু দরজা; ভারী কাজ Python worker-এ (docs/02 §2)।
 */
@Injectable()
export class KnowledgeService implements OnModuleDestroy {
  // Queue = queue-Redis — cache-Redis নয় (docs/13 A1)
  private readonly ingestionQueue = new Queue('ingestion', {
    connection: redisOptionsFromUrl(
      process.env.REDIS_QUEUE_URL ?? 'redis://localhost:6380',
    ),
  });

  private readonly s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1', // MinIO-র জন্য placeholder; AWS-এ প্রকৃত region
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'agentos',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'agentos_dev',
    },
  });
  private readonly bucket = process.env.S3_BUCKET ?? 'knowledge';

  constructor(private readonly db: DatabaseService) {}

  /** PDF upload (F3.1): source row → S3 put → queue job। Worker বাকিটা করে। */
  async uploadPdf(
    orgId: string,
    agentId: string,
    filename: string,
    data: Buffer,
  ): Promise<SourceDto> {
    if (!data.length) throw new BadRequestException('empty file');

    const source = await this.db.withOrg(orgId, async (client) => {
      const agent = await client.query('SELECT id FROM agents WHERE id = $1', [
        agentId,
      ]);
      if (!agent.rowCount) throw new NotFoundException('agent not found');

      const res = await client.query(
        `INSERT INTO knowledge_sources (org_id, agent_id, type, name, status)
         VALUES ($1, $2, 'pdf', $3, 'uploading')
         RETURNING id, type, name, status, error, created_at`,
        [orgId, agentId, filename],
      );
      return res.rows[0];
    });

    const s3Key = `${orgId}/${agentId}/${source.id}.pdf`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: data,
        ContentType: 'application/pdf',
      }),
    );

    await this.db.withOrg(orgId, (client) =>
      client.query('UPDATE knowledge_sources SET s3_key = $2 WHERE id = $1', [
        source.id,
        s3Key,
      ]),
    );

    // Retry-safe: pipeline hash-diff idempotent — আবার চললে unchanged সব skip
    await this.ingestionQueue.add(
      'ingest',
      { orgId, agentId, sourceId: source.id },
      {
        jobId: `ingest-${source.id}`, // idempotency key (docs/02 §4); BullMQ ':' নিষেধ করে
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 1_000,
      },
    );

    return toDto(source);
  }

  async list(orgId: string, agentId: string): Promise<SourceDto[]> {
    return this.db.withOrg(orgId, async (client) => {
      const res = await client.query(
        `SELECT id, type, name, status, error, created_at
         FROM knowledge_sources WHERE agent_id = $1 ORDER BY created_at DESC`,
        [agentId],
      );
      return res.rows.map(toDto);
    });
  }

  // TODO(পরের sprint): FAQ entries (F3.3), source delete → chunk retire (F3.5)

  async onModuleDestroy() {
    await this.ingestionQueue.close();
  }
}

function redisOptionsFromUrl(urlStr: string) {
  const url = new URL(urlStr);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

function toDto(row: {
  id: string;
  type: string;
  name: string;
  status: string;
  error: string | null;
  created_at: Date;
}): SourceDto {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status,
    error: row.error,
    createdAt: row.created_at.toISOString(),
  };
}
