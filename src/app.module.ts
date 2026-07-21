import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';

import { HealthController } from './health.controller';
import { JsonPlaceholderService } from './json-placeholder/json-placeholder.service';
import { McpAccessGuard } from './mcp/mcp-access.guard';
import { McpController } from './mcp/mcp.controller';
import { McpServerFactory } from './mcp/mcp-server.factory';

const EnvironmentSchema = z.object({
  MCP_AUTH_TOKEN: z.string().min(16),
  MCP_ALLOWED_ORIGINS: z.string().default(''),
  PORT: z.coerce.number().int().positive().default(3000),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (environment) => EnvironmentSchema.parse(environment),
    }),
  ],
  controllers: [HealthController, McpController],
  providers: [JsonPlaceholderService, McpAccessGuard, McpServerFactory],
})
export class AppModule {}
