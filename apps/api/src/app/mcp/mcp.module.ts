import { Module } from '@nestjs/common';

import { BooksModule } from '../books/books.module';
import { ApiDocumentationService } from '../docs/api-documentation.service';
import { McpOriginGuard } from './mcp-origin.guard';
import { McpServerFactory } from './mcp-server.factory';
import { McpController } from './mcp.controller';

@Module({
  imports: [BooksModule],
  controllers: [McpController],
  providers: [ApiDocumentationService, McpOriginGuard, McpServerFactory],
  exports: [ApiDocumentationService],
})
export class McpModule {}
