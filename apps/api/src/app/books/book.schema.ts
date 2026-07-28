import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { BOOK_STATUSES, BookStatus } from '@books/contracts';

@Schema({ timestamps: true, collection: 'books' })
export class BookEntity {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 160 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  author!: string;

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  @Prop({ min: 1000, max: 2100 })
  publishedYear?: number;

  @Prop({
    required: true,
    type: String,
    enum: BOOK_STATUSES,
    default: 'to_read',
  })
  status!: BookStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type BookDocument = HydratedDocument<BookEntity>;
export const BookSchema = SchemaFactory.createForClass(BookEntity);
BookSchema.index({ ownerId: 1, createdAt: -1 });
