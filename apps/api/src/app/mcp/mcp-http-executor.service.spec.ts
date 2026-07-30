import type { ConfigService } from '@nestjs/config';

import { McpHttpExecutorService } from './mcp-http-executor.service';
import type { McpHttpOperation } from './mcp-route.models';

const operation: McpHttpOperation = {
  toolName: 'books_update',
  title: 'Update book',
  description: 'Update book',
  operationId: 'BooksController_update',
  method: 'PATCH',
  path: '/api/books/{id}',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      body: {
        type: 'object',
        properties: { status: { enum: ['read'] } },
        required: ['status'],
        additionalProperties: false,
      },
    },
    required: ['path', 'body'],
    additionalProperties: false,
  },
  outputSchema: { type: 'object' },
  annotations: { readOnlyHint: false },
};

describe('McpHttpExecutorService', () => {
  const config = {
    get: (name: string, fallback?: unknown) =>
      name === 'INTERNAL_API_URL' ? 'http://127.0.0.1:3000' : fallback,
  } as ConfigService;
  let service: McpHttpExecutorService;

  beforeEach(() => {
    service = new McpHttpExecutorService(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the existing REST route with the JWT', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'book-1', status: 'read' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await service.execute(
      operation,
      { path: { id: 'book-1' }, body: { status: 'read' } },
      'Bearer application-jwt',
      new AbortController().signal,
    );

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({
      status: 200,
      data: { id: 'book-1', status: 'read' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url).toEqual(new URL('http://127.0.0.1:3000/api/books/book-1'));
    expect(request.method).toBe('PATCH');
    expect(request.headers).toEqual({
      Authorization: 'Bearer application-jwt',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(request.body).toBe(JSON.stringify({ status: 'read' }));
  });

  it('returns the existing REST validation error', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 400,
          message: ['status must be one of the following values: read'],
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const result = await service.execute(
      operation,
      { path: { id: 'book-1' }, body: {} },
      'Bearer application-jwt',
      new AbortController().signal,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'REST operation failed with HTTP 400: status must be one of the following values: read',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
