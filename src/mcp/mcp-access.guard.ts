import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class McpAccessGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedToken = this.config.getOrThrow<string>('MCP_AUTH_TOKEN');

    if (request.headers.authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('A valid MCP bearer token is required');
    }

    this.validateOrigin(request.headers.origin);
    return true;
  }

  private validateOrigin(origin: string | undefined): void {
    if (!origin) {
      return;
    }

    const allowedOrigins = this.config
      .get<string>('MCP_ALLOWED_ORIGINS', '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException(`Origin ${origin} is not allowed`);
    }
  }
}
