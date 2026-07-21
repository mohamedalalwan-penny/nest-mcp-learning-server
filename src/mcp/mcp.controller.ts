import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';

import { McpAccessGuard } from './mcp-access.guard';
import { McpServerFactory } from './mcp-server.factory';

@Controller('mcp')
@UseGuards(McpAccessGuard)
export class McpController {
  constructor(private readonly serverFactory: McpServerFactory) {}

  @Post()
  async handleRequest(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: unknown,
  ): Promise<void> {
    const server = this.serverFactory.create();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    let cleanedUp = false;

    const cleanup = async (): Promise<void> => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      await transport.close();
      await server.close();
    };

    response.once('close', () => void cleanup());

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch {
      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    } finally {
      await cleanup();
    }
  }

  @Get()
  rejectGet(@Res() response: Response): void {
    this.methodNotAllowed(response);
  }

  @Delete()
  rejectDelete(@Res() response: Response): void {
    this.methodNotAllowed(response);
  }

  private methodNotAllowed(response: Response): void {
    response.status(HttpStatus.METHOD_NOT_ALLOWED).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed in stateless mode' },
      id: null,
    });
  }
}
