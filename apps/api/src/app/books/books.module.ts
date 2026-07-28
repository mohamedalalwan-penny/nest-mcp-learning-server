import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BookEntity, BookSchema } from './book.schema';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookEntity.name, schema: BookSchema },
    ]),
  ],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
