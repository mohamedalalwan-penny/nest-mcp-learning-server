import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const apiUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: process.env.DEMO_USER_EMAIL,
    password: process.env.DEMO_USER_PASSWORD,
  }),
});
if (!loginResponse.ok) {
  throw new Error(`Demo login failed with HTTP ${loginResponse.status}`);
}
const { accessToken } = await loginResponse.json();

const unauthorizedResponse = await fetch(`${apiUrl}/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'unauthorized-check', version: '1.0.0' },
    },
  }),
});
if (unauthorizedResponse.status !== 401) {
  throw new Error(
    `Unauthenticated MCP request returned HTTP ${unauthorizedResponse.status}`,
  );
}

const unsupportedGetResponse = await fetch(`${apiUrl}/mcp`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (unsupportedGetResponse.status !== 405) {
  throw new Error(
    `Authenticated MCP GET returned HTTP ${unsupportedGetResponse.status}`,
  );
}

const transport = new StreamableHTTPClientTransport(new URL(`${apiUrl}/mcp`), {
  requestInit: {
    headers: { Authorization: `Bearer ${accessToken}` },
  },
});
const client = new Client({ name: 'books-poc-verifier', version: '1.0.0' });

try {
  await client.connect(transport);
  const resources = await client.listResources();
  const documentationResource = resources.resources.find(
    (resource) => resource.uri === 'books://api-docs',
  );
  if (!documentationResource) {
    throw new Error('The generated Books API documentation resource is missing');
  }
  const documentation = await client.readResource({
    uri: documentationResource.uri,
  });
  const documentationText = documentation.contents
    .map((content) => ('text' in content ? content.text : ''))
    .join('\n');
  if (
    !documentationText.includes('books_create') ||
    !documentationText.includes('POST /api/books')
  ) {
    throw new Error('The generated Books API documentation is incomplete');
  }
  const tools = await client.listTools();
  const created = await client.callTool({
    name: 'books_create',
    arguments: {
      body: {
        title: `MCP verification ${Date.now()}`,
        author: 'Local verifier',
        status: 'to_read',
      },
    },
  });
  if (created.isError) {
    throw new Error('books_create returned an MCP error');
  }
  const id = created.structuredContent?.data?.id;
  if (typeof id !== 'string') {
    throw new Error('books_create did not return a book ID');
  }
  const updated = await client.callTool({
    name: 'books_update',
    arguments: { path: { id }, body: { status: 'read' } },
  });
  const removed = await client.callTool({
    name: 'books_remove',
    arguments: { path: { id } },
  });
  if (updated.isError || removed.isError) {
    throw new Error('The MCP update/delete verification failed');
  }

  console.log(
    JSON.stringify(
      {
        tools: tools.tools.map((tool) => tool.name),
        documentation: `${documentationResource.uri} generated from OpenAPI`,
        authentication: 'unauthenticated request rejected with 401',
        unsupportedGet: 'rejected with 405',
        temporaryCrudCycle: 'passed and cleaned up',
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
