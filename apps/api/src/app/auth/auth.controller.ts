import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { LoginResponse, User } from '@books/contracts';

import { LoginDto } from './auth.dto';
import { CurrentUser, JwtUser } from './auth.models';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in to the books application' })
  login(@Body() input: LoginDto): Promise<LoginResponse> {
    return this.auth.login(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated application user' })
  me(@CurrentUser() user: JwtUser): User {
    return {
      id: user.sub,
      email: user.email,
      displayName: user.displayName,
    };
  }
}
