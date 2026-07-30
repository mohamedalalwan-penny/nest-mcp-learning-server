import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export const BOOKS_API_DOCS_URI = 'books://api-docs';

export type JsonSchema = Record<string, unknown>;

export interface McpHttpOperation {
  toolName: string;
  title: string;
  description: string;
  operationId: string;
  method: string;
  path: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  annotations: ToolAnnotations;
}
