import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { McpHttpOperation } from './mcp-route.models';

@Injectable()
export class McpHttpExecutorService {
  constructor(private readonly config: ConfigService) {}

  async execute(
    operation: McpHttpOperation,
    input: unknown,
    authorization: string,
    requestSignal: AbortSignal,
  ): Promise<CallToolResult> {
    const argumentsObject = (input ?? {}) as Record<string, unknown>;
    const internalApiUrl =
      this.config.get<string>('INTERNAL_API_URL') ??
      `http://127.0.0.1:${this.config.get<number>('PORT', 3000)}`;
    const url = new URL(
      this.applyPathArguments(
        operation.path,
        argumentsObject.path as Record<string, unknown> | undefined,
      ),
      internalApiUrl,
    );
    this.applyQueryArguments(
      url,
      argumentsObject.query as Record<string, unknown> | undefined,
    );

    const timeout = AbortSignal.timeout(
      this.config.get<number>('MCP_TOOL_TIMEOUT_MS', 10_000),
    );
    const signal = AbortSignal.any([requestSignal, timeout]);
    const hasBody = argumentsObject.body !== undefined;

    try {
      const response = await fetch(url, {
        method: operation.method,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(hasBody ? { body: JSON.stringify(argumentsObject.body) } : {}),
        signal,
      });
      const data = await this.readResponse(response);

      if (!response.ok) {
        return this.errorResult(
          `REST operation failed with HTTP ${response.status}: ${this.describeError(data)}`,
        );
      }

      const result = { status: response.status, data };
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      if (signal.aborted) {
        return this.errorResult('REST operation timed out or was cancelled');
      }
      return this.errorResult(
        error instanceof Error ? error.message : 'REST operation failed',
      );
    }
  }

  private applyPathArguments(
    path: string,
    parameters: Record<string, unknown> = {},
  ): string {
    return path.replace(/\{([^}]+)\}/g, (_match, name: string) =>
      encodeURIComponent(String(parameters[name])),
    );
  }

  private applyQueryArguments(
    url: URL,
    query: Record<string, unknown> = {},
  ): void {
    for (const [name, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }
      for (const item of Array.isArray(value) ? value : [value]) {
        url.searchParams.append(
          name,
          typeof item === 'object' ? JSON.stringify(item) : String(item),
        );
      }
    }
  }

  private async readResponse(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    if (!text) {
      return null;
    }
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
    return text;
  }

  private describeError(data: unknown): string {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = data.message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
    return typeof data === 'string' ? data : 'Request rejected';
  }

  private errorResult(message: string): CallToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}
