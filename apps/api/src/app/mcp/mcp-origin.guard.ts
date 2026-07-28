import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class McpOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (!origin) {
      return true;
    }

    const allowedOrigins = this.config
      .get<string>('MCP_ALLOWED_ORIGINS', '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException(`Origin ${origin} is not allowed`);
    }
    return true;
  }
}
