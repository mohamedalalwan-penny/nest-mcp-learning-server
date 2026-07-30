import type { OpenAPIObject } from '@nestjs/swagger';

import { MCP_EXCLUDE_EXTENSION } from './mcp-exclude.decorator';
import { McpRouteCatalogService } from './mcp-route-catalog.service';

describe('McpRouteCatalogService', () => {
  it('generates tools for authenticated OpenAPI operations unless explicitly excluded', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      components: {
        schemas: {
          CreateBookDto: {
            type: 'object',
            properties: { title: { type: 'string' } },
            required: ['title'],
          },
        },
      },
      paths: {
        '/api/auth/login': {
          post: {
            operationId: 'AuthController_login',
            summary: 'Login',
            responses: { 201: { description: '' } },
          },
        },
        '/api/auth/me': {
          get: {
            operationId: 'AuthController_me',
            summary: 'Current user',
            security: [{ bearer: [] }],
            responses: {
              200: {
                description: '',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        '/api/books': {
          options: {
            operationId: 'BooksController_options',
            summary: 'Describe book options',
            security: [{ bearer: [] }],
            responses: { 200: { description: '' } },
          },
          get: {
            operationId: 'BooksController_list',
            summary: 'List books',
            security: [{ bearer: [] }],
            parameters: [
              {
                in: 'query',
                name: 'q',
                required: false,
                schema: { type: 'string' },
              },
            ],
            responses: { 200: { description: '' } },
          },
          post: {
            operationId: 'BooksController_create',
            summary: 'Create book',
            security: [{ bearer: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateBookDto' },
                },
              },
            },
            responses: { 201: { description: '' } },
          },
        },
        '/api/assistant/chat': {
          post: {
            operationId: 'AssistantController_chat',
            summary: 'Assistant',
            security: [{ bearer: [] }],
            [MCP_EXCLUDE_EXTENSION]: true,
            responses: { 200: { description: '' } },
          } as OpenAPIObject['paths'][string]['post'] & Record<string, unknown>,
        },
      },
    } satisfies OpenAPIObject;
    const service = new McpRouteCatalogService();

    service.initialize(document);
    const operations = service.getOperations();

    expect(operations.map((operation) => operation.toolName)).toEqual([
      'auth_me',
      'books_create',
      'books_list',
      'books_options',
    ]);
    expect(
      operations.find((operation) => operation.toolName === 'books_create')
        ?.inputSchema,
    ).toMatchObject({
      required: ['body'],
      properties: {
        body: {
          type: 'object',
          required: ['title'],
          properties: { title: { type: 'string' } },
        },
      },
    });
    expect(service.getDocumentation()).toContain('# Test API');
    expect(service.getDocumentation()).toContain(
      'MCP tool: `books_create`',
    );
    expect(service.getDocumentation()).toContain(
      'REST operation: `POST /api/books`',
    );
  });
});
