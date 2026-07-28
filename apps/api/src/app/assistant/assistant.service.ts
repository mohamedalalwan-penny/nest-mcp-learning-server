import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createVertex } from '@ai-sdk/google-vertex';
import { createMCPClient } from '@ai-sdk/mcp';
import { stepCountIs, streamText } from 'ai';

import type { AssistantStreamEvent } from '@books/contracts';

import { AssistantChatDto } from './assistant.dto';

const WRITE_TOOLS = new Set(['create_book', 'update_book', 'delete_book']);

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
      const [definitions, documentation] = await Promise.all([
        mcpClient.listTools(),
        mcpClient.readResource({ uri: 'books://api-docs' }),
      ]);
      const tools = mcpClient.toolsFromDefinitions(definitions);
      const docsText = documentation.contents
        .map((content) => ('text' in content ? content.text : ''))
        .join('\n');
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

${docsText}

Rules:
- Use MCP for every question about the user's live book collection.
- General greetings and explanations do not need a tool.
- Never invent a book, ID, status, or successful mutation.
- A mutation succeeded only when its MCP tool returned a successful result.
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
          if (
            toolOutput.type === 'tool-result' &&
            WRITE_TOOLS.has(toolCall.toolName)
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
}
