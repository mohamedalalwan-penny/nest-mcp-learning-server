import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { BOOK_STATUSES, BookStatus } from '@books/contracts';

export class CreateBookDto {
  @ApiProperty({ example: 'The Pragmatic Programmer' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: 'Andrew Hunt and David Thomas' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  author!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 1999, minimum: 1000, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(2100)
  publishedYear?: number;

  @ApiPropertyOptional({ enum: BOOK_STATUSES, default: 'to_read' })
  @IsOptional()
  @IsIn(BOOK_STATUSES)
  status?: BookStatus;
}

export class UpdateBookDto extends PartialType(CreateBookDto) {}

export class ListBooksQueryDto {
  @ApiPropertyOptional({ description: 'Search title or author' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: BOOK_STATUSES })
  @IsOptional()
  @IsIn(BOOK_STATUSES)
  status?: BookStatus;
}
