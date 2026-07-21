import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import {
  JsonPlaceholderService,
  type Post,
  type User,
} from '../json-placeholder/json-placeholder.service';

const API_DOCS_URI = 'jsonplaceholder://api-docs';

const PostSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  body: z.string(),
});

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
  phone: z.string(),
  website: z.string(),
});

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const API_DOCUMENTATION = `# JSONPlaceholder API (learning subset)

Base URL: \`https://jsonplaceholder.typicode.com\`

This MCP server documents and calls a small, read-only subset of JSONPlaceholder.

## Endpoints

- \`GET /posts\` — list posts.
- \`GET /posts?userId={userId}\` — filter posts by user.
- \`GET /posts/{id}\` — get one post.
- \`GET /users/{id}\` — get one user.

## Fields

A post contains \`userId\`, \`id\`, \`title\`, and \`body\`.
A user contains \`id\`, \`name\`, \`username\`, \`email\`, \`phone\`, and \`website\`.

## MCP limits

- \`list_posts\` returns at most 10 posts.
- \`get_post\` accepts IDs 1 through 100.
- \`get_user\` accepts IDs 1 through 10.
- All tools are read-only.
`;

@Injectable()
export class McpServerFactory {
  constructor(private readonly api: JsonPlaceholderService) {}

  create(): McpServer {
    const server = new McpServer(
      { name: 'jsonplaceholder-learning-server', version: '1.0.0' },
      {
        instructions:
          'Read jsonplaceholder://api-docs for endpoint documentation. Use the tools only for live, read-only JSONPlaceholder data. No write operations are available.',
      },
    );

    server.registerResource(
      'jsonplaceholder-api-docs',
      API_DOCS_URI,
      {
        title: 'JSONPlaceholder API documentation',
        description: 'A concise reference for the API subset exposed by this server.',
        mimeType: 'text/markdown',
      },
      () => ({
        contents: [
          {
            uri: API_DOCS_URI,
            mimeType: 'text/markdown',
            text: API_DOCUMENTATION,
          },
        ],
      }),
    );

    server.registerTool(
      'list_posts',
      {
        title: 'List posts',
        description:
          'List up to 10 JSONPlaceholder posts, optionally filtered by user ID.',
        inputSchema: {
          userId: z.number().int().min(1).max(10).optional(),
          limit: z.number().int().min(1).max(10).default(3),
        },
        outputSchema: {
          count: z.number().int(),
          posts: z.array(PostSchema),
        },
        annotations: readOnlyAnnotations,
      },
      async ({ userId, limit }) =>
        this.runTool(async () => {
          const posts = await this.api.listPosts(userId, limit);
          return { count: posts.length, posts };
        }),
    );

    server.registerTool(
      'get_post',
      {
        title: 'Get post',
        description: 'Get one JSONPlaceholder post by its ID.',
        inputSchema: {
          id: z.number().int().min(1).max(100),
        },
        outputSchema: { post: PostSchema },
        annotations: readOnlyAnnotations,
      },
      async ({ id }) =>
        this.runTool(async () => ({ post: await this.api.getPost(id) })),
    );

    server.registerTool(
      'get_user',
      {
        title: 'Get user',
        description: 'Get one JSONPlaceholder user by its ID.',
        inputSchema: {
          id: z.number().int().min(1).max(10),
        },
        outputSchema: { user: UserSchema },
        annotations: readOnlyAnnotations,
      },
      async ({ id }) =>
        this.runTool(async () => ({ user: await this.api.getUser(id) })),
    );

    return server;
  }

  private async runTool<T extends Record<string, unknown>>(
    operation: () => Promise<T>,
  ): Promise<{
    content: [{ type: 'text'; text: string }];
    structuredContent?: T;
    isError?: boolean;
  }> {
    try {
      const result = await operation();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: 'JSONPlaceholder data could not be retrieved. Please try again.',
          },
        ],
        isError: true,
      };
    }
  }
}

export type { Post, User };
