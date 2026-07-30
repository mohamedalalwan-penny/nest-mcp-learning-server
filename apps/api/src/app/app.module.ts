import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AssistantModule } from './assistant/assistant.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { HealthController } from './health.controller';
import { McpModule } from './mcp/mcp.module';

interface EnvironmentVariables {
  PORT: number;
  WEB_ORIGIN: string;
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  SEED_DEMO_USER: boolean;
  DEMO_USER_EMAIL?: string;
  DEMO_USER_PASSWORD?: string;
  DEMO_USER_NAME: string;
  GOOGLE_CREDS_B64: string;
  GOOGLE_CLOUD_PROJECT: string;
  GOOGLE_CLOUD_LOCATION: string;
  GEMINI_MODEL: string;
  MCP_URL?: string;
  INTERNAL_API_URL?: string;
  MCP_TOOL_TIMEOUT_MS: number;
  MCP_ALLOWED_ORIGINS: string;
}

const stringValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const environmentVariables = (
  environment: Record<string, unknown>,
): EnvironmentVariables => ({
  PORT: Number(environment.PORT ?? 3000),
  WEB_ORIGIN: stringValue(environment.WEB_ORIGIN, 'http://localhost:4200'),
  MONGODB_URI: environment.MONGODB_URI as string,
  MONGODB_DB_NAME: stringValue(environment.MONGODB_DB_NAME, 'mcp_books_poc'),
  JWT_SECRET: environment.JWT_SECRET as string,
  JWT_EXPIRES_IN: stringValue(environment.JWT_EXPIRES_IN, '8h'),
  SEED_DEMO_USER: environment.SEED_DEMO_USER === 'true',
  DEMO_USER_EMAIL: environment.DEMO_USER_EMAIL as string | undefined,
  DEMO_USER_PASSWORD: environment.DEMO_USER_PASSWORD as string | undefined,
  DEMO_USER_NAME: stringValue(environment.DEMO_USER_NAME, 'Demo Reader'),
  GOOGLE_CREDS_B64: environment.GOOGLE_CREDS_B64 as string,
  GOOGLE_CLOUD_PROJECT: environment.GOOGLE_CLOUD_PROJECT as string,
  GOOGLE_CLOUD_LOCATION: stringValue(
    environment.GOOGLE_CLOUD_LOCATION,
    'us-central1',
  ),
  GEMINI_MODEL: environment.GEMINI_MODEL as string,
  MCP_URL: environment.MCP_URL as string | undefined,
  INTERNAL_API_URL: environment.INTERNAL_API_URL as string | undefined,
  MCP_TOOL_TIMEOUT_MS: Number(environment.MCP_TOOL_TIMEOUT_MS ?? 10_000),
  MCP_ALLOWED_ORIGINS: stringValue(environment.MCP_ALLOWED_ORIGINS, ''),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: environmentVariables,
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
