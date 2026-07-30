import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'change-me', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;
}
