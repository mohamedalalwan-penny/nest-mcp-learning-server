import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { McpOriginGuard } from './mcp-origin.guard';

describe('McpOriginGuard', () => {
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:4200,http://localhost:6274'),
  } as unknown as ConfigService;
  const guard = new McpOriginGuard(config);

  function context(origin?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { origin } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('accepts requests without Origin and exact allowed origins', () => {
    expect(guard.canActivate(context())).toBe(true);
    expect(guard.canActivate(context('http://localhost:4200'))).toBe(true);
  });

  it('rejects origins that are not explicitly listed', () => {
    expect(() => guard.canActivate(context('https://example.com'))).toThrow(
      ForbiddenException,
    );
  });
});
