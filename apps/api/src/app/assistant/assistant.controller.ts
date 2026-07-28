import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { AssistantStreamEvent } from '@books/contracts';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssistantChatDto } from './assistant.dto';
import { AssistantService } from './assistant.service';

@ApiTags('Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Stream an MCP-backed Gemini assistant response' })
  async chat(
    @Body() input: AssistantChatDto,
    @Headers('authorization') authorization: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    const abortController = new AbortController();
    request.once('aborted', () => abortController.abort());
    response.once('close', () => abortController.abort());

    const emit = (event: AssistantStreamEvent): void => {
      if (!response.writableEnded) {
        response.write(
          `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        );
      }
    };

    await this.assistant.stream(
      input,
      authorization,
      abortController.signal,
      emit,
    );
    if (!response.writableEnded) {
      response.end();
    }
  }
}
