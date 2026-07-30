import { Module } from '@nestjs/common';

import { McpHttpExecutorService } from './mcp-http-executor.service';
import { McpOriginGuard } from './mcp-origin.guard';
import { McpRouteCatalogService } from './mcp-route-catalog.service';
import { McpServerFactory } from './mcp-server.factory';
import { McpController } from './mcp.controller';

@Module({
  controllers: [McpController],
  providers: [
    McpHttpExecutorService,
    McpOriginGuard,
    McpRouteCatalogService,
    McpServerFactory,
  ],
  exports: [McpRouteCatalogService],
})
export class McpModule {}
