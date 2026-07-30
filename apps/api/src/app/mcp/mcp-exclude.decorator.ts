import { ApiExtension } from '@nestjs/swagger';

export const MCP_EXCLUDE_EXTENSION = 'x-mcp-exclude';

/**
 * Opts an authenticated REST operation out of automatic MCP exposure.
 *
 * Application endpoints are exposed by default. Use this only for endpoints
 * that must not call themselves through MCP, such as the AI assistant.
 */
export const McpExclude = (): MethodDecorator & ClassDecorator =>
  ApiExtension(MCP_EXCLUDE_EXTENSION, true);
