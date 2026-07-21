import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
  Logger.log(`Health: http://localhost:${port}/health`, 'Bootstrap');
  Logger.log(`MCP:    http://localhost:${port}/mcp`, 'Bootstrap');
}

void bootstrap();
