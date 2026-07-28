import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';

import type { LoginResponse, User } from '@books/contracts';

import { LoginDto } from './auth.dto';
import { JwtUser } from './auth.models';
import { UsersService } from './users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginDto): Promise<LoginResponse> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const publicUser: User = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
    const payload: JwtUser = {
      sub: publicUser.id,
      email: publicUser.email,
      displayName: publicUser.displayName,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: publicUser,
    };
  }
}
