import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { Book, BookListResponse } from '@books/contracts';

import { CurrentUser, JwtUser } from '../auth/auth.models';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateBookDto,
  ListBooksQueryDto,
  UpdateBookDto,
} from './books.dto';
import { BooksService } from './books.service';

@ApiTags('Books')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user’s books' })
  list(
    @CurrentUser() user: JwtUser,
    @Query() query: ListBooksQueryDto,
  ): Promise<BookListResponse> {
    return this.books.list(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one owned book' })
  get(@CurrentUser() user: JwtUser, @Param('id') id: string): Promise<Book> {
    return this.books.get(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a book' })
  create(
    @CurrentUser() user: JwtUser,
    @Body() input: CreateBookDto,
  ): Promise<Book> {
    return this.books.create(user.sub, input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one owned book' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() input: UpdateBookDto,
  ): Promise<Book> {
    return this.books.update(user.sub, id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one owned book' })
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string): Promise<Book> {
    return this.books.remove(user.sub, id);
  }
}
