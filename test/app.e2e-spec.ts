import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  JsonPlaceholderService,
  type Post,
  type User,
} from '../src/json-placeholder/json-placeholder.service';

const TOKEN = 'test-token-at-least-16-characters';

const post: Post = {
  userId: 1,
  id: 1,
  title: 'A test post',
  body: 'Test body',
};

const user: User = {
  id: 1,
  name: 'Test User',
  username: 'tester',
  email: 'test@example.com',
  phone: '123',
  website: 'example.com',
};

describe('Nest MCP server (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let mcpUrl: URL;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JsonPlaceholderService)
      .useValue({
        listPosts: jest.fn().mockResolvedValue([post]),
        getPost: jest.fn().mockResolvedValue(post),
        getUser: jest.fn().mockResolvedValue(user),
      })
      .compile();

    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    httpServer = app.getHttpServer() as Server;
    const address = httpServer.address() as AddressInfo;
    mcpUrl = new URL(`http://127.0.0.1:${address.port}/mcp`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes an unprotected health endpoint', async () => {
    await request(httpServer).get('/health').expect(200, { status: 'ok' });
  });

  it('rejects missing tokens and untrusted origins', async () => {
    await request(httpServer).post('/mcp').send({}).expect(401);

    await request(httpServer)
      .post('/mcp')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
  });

  it('rejects GET and DELETE in stateless mode', async () => {
    await request(httpServer)
      .get('/mcp')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(405);

    await request(httpServer)
      .delete('/mcp')
      .set('Authorization', `Bearer ${TOKEN}`)
      .expect(405);
  });

  it('initializes, reads the resource, and calls every tool over MCP', async () => {
    const client = await connectClient('protocol-test');

    try {
      const resources = await client.listResources();
      expect(resources.resources.map((resource) => resource.uri)).toEqual([
        'jsonplaceholder://api-docs',
      ]);

      const documentation = await client.readResource({
        uri: 'jsonplaceholder://api-docs',
      });
      expect(documentation.contents[0]).toMatchObject({
        mimeType: 'text/markdown',
      });

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        'get_post',
        'get_user',
        'list_posts',
      ]);

      const listResult = await client.callTool({
        name: 'list_posts',
        arguments: { userId: 1, limit: 1 },
      });
      expect(listResult.structuredContent).toEqual({ count: 1, posts: [post] });

      const postResult = await client.callTool({
        name: 'get_post',
        arguments: { id: 1 },
      });
      expect(postResult.structuredContent).toEqual({ post });

      const userResult = await client.callTool({
        name: 'get_user',
        arguments: { id: 1 },
      });
      expect(userResult.structuredContent).toEqual({ user });
    } finally {
      await client.close();
    }
  });

  it('validates tool arguments and supports an independent second client', async () => {
    const client = await connectClient('stateless-client');

    try {
      const invalidResult = await client.callTool({
        name: 'get_post',
        arguments: { id: 0 },
      });
      expect(invalidResult.isError).toBe(true);

      const result = await client.callTool({
        name: 'get_user',
        arguments: { id: 1 },
      });
      expect(result.structuredContent).toEqual({ user });
    } finally {
      await client.close();
    }
  });

  async function connectClient(name: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: {
        headers: { Authorization: `Bearer ${TOKEN}` },
      },
    });
    const client = new Client({ name, version: '1.0.0' });
    await client.connect(transport);
    return client;
  }
});
