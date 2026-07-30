import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createVertex } from '@ai-sdk/google-vertex';
import { createMCPClient } from '@ai-sdk/mcp';
import { dynamicTool, jsonSchema, stepCountIs, streamText } from 'ai';

import type { AssistantStreamEvent } from '@books/contracts';

import { AssistantChatDto } from './assistant.dto';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(private readonly config: ConfigService) {}

  async stream(
    input: AssistantChatDto,
    authorization: string,
    abortSignal: AbortSignal,
    emit: (event: AssistantStreamEvent) => void,
  ): Promise<void> {
    emit({ type: 'status', label: 'Connecting to the Books MCP server' });

    const mcpUrl =
      this.config.get<string>('MCP_URL') ??
      `http://127.0.0.1:${this.config.get<number>('PORT', 3000)}/mcp`;
    const mcpClient = await createMCPClient({
      transport: {
        type: 'http',
        url: mcpUrl,
        headers: { Authorization: authorization },
      },
      maxRetries: 1,
      clientName: 'books-gemini-assistant',
      version: '1.0.0',
    });

    try {
      const definitions = await mcpClient.listTools();
      const resources = await mcpClient.listResources();
      const resourceTools = Object.fromEntries(
        resources.resources.map((resource) => [
          `read_mcp_resource_${this.toToolName(resource.name)}`,
          dynamicTool({
            description: `Read the MCP resource "${resource.title ?? resource.name}". ${resource.description ?? ''}`.trim(),
            inputSchema: jsonSchema({
              type: 'object',
              properties: {},
              additionalProperties: false,
            }),
            execute: () => mcpClient.readResource({ uri: resource.uri }),
          }),
        ]),
      );
      const tools = {
        ...mcpClient.toolsFromDefinitions(definitions),
        ...resourceTools,
      };
      const mutationTools = new Set(
        definitions.tools
          .filter((tool) => tool.annotations?.readOnlyHint === false)
          .map((tool) => tool.name),
      );
      let changedBooks = false;
      let completeText = '';
      let streamError: unknown;

      emit({
        type: 'status',
        label: 'Books MCP tools are ready',
      });

      const credentials = JSON.parse(
        Buffer.from(
          this.config.getOrThrow<string>('GOOGLE_CREDS_B64'),
          'base64',
        ).toString('utf8'),
      ) as Record<string, unknown>;
      const vertex = createVertex({
        project: this.config.getOrThrow<string>('GOOGLE_CLOUD_PROJECT'),
        location: this.config.get<string>(
          'GOOGLE_CLOUD_LOCATION',
          'us-central1',
        ),
        googleAuthOptions: { credentials },
      });

      const result = streamText({
        model: vertex(this.config.getOrThrow<string>('GEMINI_MODEL')),
        tools,
        toolChoice: 'auto',
        stopWhen: stepCountIs(5),
        abortSignal,
        messages: input.messages,
        system: `You are a concise books assistant embedded in a learning application.

Rules:
- Use MCP for every question about the user's live book collection.
- General greetings and explanations do not need a tool.
- Never invent a book, ID, status, or successful mutation.
- A mutation succeeded only when its MCP tool returned a successful result.
- Read an available MCP documentation resource when the user asks about APIs, tools, endpoints, or capabilities.
- Respond naturally and conversationally. Explain capabilities through user-friendly examples rather than API terminology unless technical details are requested.
- Format useful responses as Markdown.
- Do not expose hidden reasoning, credentials, tool arguments, or implementation secrets.`,
        onToolExecutionStart: ({ toolCall }) => {
          emit({
            type: 'status',
            label: `Calling MCP tool: ${toolCall.toolName}`,
            tool: toolCall.toolName,
          });
        },
        onToolExecutionEnd: ({ toolCall, toolOutput }) => {
          const output =
            toolOutput.type === 'tool-result' ? toolOutput.output : undefined;
          const failed =
            typeof output === 'object' &&
            output !== null &&
            'isError' in output &&
            output.isError === true;
          if (
            toolOutput.type === 'tool-result' &&
            mutationTools.has(toolCall.toolName) &&
            !failed
          ) {
            changedBooks = true;
          }
        },
        onError: ({ error }) => {
          streamError = error;
        },
      });

      for await (const delta of result.textStream) {
        if (!delta) {
          continue;
        }
        completeText += delta;
        emit({ type: 'delta', delta });
      }

      if (streamError) {
        throw streamError instanceof Error
          ? streamError
          : new Error('Gemini stream failed');
      }
      emit({
        type: 'done',
        message: completeText,
        changedBooks,
      });
    } catch (error) {
      if (abortSignal.aborted) {
        return;
      }
      this.logger.error(
        'Assistant turn failed',
        error instanceof Error ? error.stack : String(error),
      );
      emit({
        type: 'error',
        message:
          'The assistant could not complete that request. Check the API logs and try again.',
      });
    } finally {
      await mcpClient.close();
    }
  }

  private toToolName(value: string): string {
    return (
      value
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'documentation'
    );
  }
}
