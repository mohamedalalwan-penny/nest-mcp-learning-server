import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { z } from 'zod';

import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { HealthController } from './health.controller';
import { McpModule } from './mcp/mcp.module';

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:4200'),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('mcp_books_poc'),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default('8h'),
  SEED_DEMO_USER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_PASSWORD: z.string().min(8).optional(),
  DEMO_USER_NAME: z.string().default('Demo Reader'),
  GOOGLE_CREDS_B64: z.string().min(1),
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  GOOGLE_CLOUD_LOCATION: z.string().default('us-central1'),
  GEMINI_MODEL: z.string().min(1),
  MCP_URL: z.string().url().optional(),
  MCP_ALLOWED_ORIGINS: z.string().default(''),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (environment) => EnvironmentSchema.parse(environment),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.getOrThrow<string>('MONGODB_DB_NAME'),
      }),
    }),
    AuthModule,
    BooksModule,
    McpModule,
    AssistantModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
