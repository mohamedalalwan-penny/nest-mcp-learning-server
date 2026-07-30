import { Injectable } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { McpHttpExecutorService } from './mcp-http-executor.service';
import { McpRouteCatalogService } from './mcp-route-catalog.service';
import { BOOKS_API_DOCS_URI } from './mcp-route.models';

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly catalog: McpRouteCatalogService,
    private readonly executor: McpHttpExecutorService,
  ) {}

  create(authorization: string): Server {
    const server = new Server(
      { name: 'books-mcp-poc', version: '1.0.0' },
      {
        capabilities: { resources: {}, tools: {} },
        instructions:
          'Tools and API documentation are generated from the live NestJS OpenAPI document. Tools execute existing REST operations with the current bearer token.',
      },
    );

    server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: [
        {
          uri: BOOKS_API_DOCS_URI,
          name: 'books-api-documentation',
          title: 'Books API documentation',
          description:
            'Human-friendly API reference generated from the live NestJS OpenAPI document.',
          mimeType: 'text/markdown',
        },
      ],
    }));

    server.setRequestHandler(ReadResourceRequestSchema, (request) => {
      if (request.params.uri !== BOOKS_API_DOCS_URI) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown resource: ${request.params.uri}`,
        );
      }
      return {
        contents: [
          {
            uri: BOOKS_API_DOCS_URI,
            mimeType: 'text/markdown',
            text: this.catalog.getDocumentation(),
          },
        ],
      };
    });

    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.catalog.getOperations().map((operation) => ({
        name: operation.toolName,
        title: operation.title,
        description: operation.description,
        inputSchema: operation.inputSchema,
        outputSchema: operation.outputSchema,
        annotations: operation.annotations,
        _meta: {
          'books/httpMethod': operation.method,
          'books/restPath': operation.path,
          'books/operationId': operation.operationId,
        },
      })),
    }));

    server.setRequestHandler(
      CallToolRequestSchema,
      async (request, context) => {
        const operation = this.catalog
          .getOperations()
          .find((candidate) => candidate.toolName === request.params.name);
        if (!operation) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown tool: ${request.params.name}`,
          );
        }
        return this.executor.execute(
          operation,
          request.params.arguments,
          authorization,
          context.signal,
        );
      },
    );

    return server;
  }
}
