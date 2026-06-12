import multipart from '@fastify/multipart';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );
  // F3.1: প্রতি file ≤ 25 MB
  await app.register(multipart as never, {
    limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  });
  app.setGlobalPrefix('v1');
  await app.listen(Number(process.env.API_PORT ?? 4000), '0.0.0.0');
}
bootstrap();
