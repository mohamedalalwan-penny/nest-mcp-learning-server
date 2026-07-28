import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type {
  Book,
  BookListResponse,
  CreateBookRequest,
  UpdateBookRequest,
} from '@books/contracts';

import { BookDocument, BookEntity } from './book.schema';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(BookEntity.name)
    private readonly books: Model<BookDocument>,
  ) {}

  async list(
    ownerId: string,
    options: { q?: string; status?: string; limit?: number } = {},
  ): Promise<BookListResponse> {
    const filter: Record<string, unknown> = {
      ownerId: new Types.ObjectId(ownerId),
    };
    if (options.status) {
      filter.status = options.status;
    }
    if (options.q?.trim()) {
      const escaped = options.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { author: { $regex: escaped, $options: 'i' } },
      ];
    }

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const [documents, total] = await Promise.all([
      this.books.find(filter).sort({ createdAt: -1 }).limit(limit).lean().exec(),
      this.books.countDocuments(filter).exec(),
    ]);

    return {
      books: documents.map((document) => this.toBook(document)),
      total,
    };
  }

  async get(ownerId: string, id: string): Promise<Book> {
    const document = await this.findOwned(ownerId, id);
    return this.toBook(document);
  }

  async create(ownerId: string, input: CreateBookRequest): Promise<Book> {
    const document = await this.books.create({
      ...input,
      title: input.title.trim(),
      author: input.author.trim(),
      status: input.status ?? 'to_read',
      ownerId: new Types.ObjectId(ownerId),
    });
    return this.toBook(document.toObject());
  }

  async update(
    ownerId: string,
    id: string,
    input: UpdateBookRequest,
  ): Promise<Book> {
    const document = await this.books
      .findOneAndUpdate(
        { _id: this.objectId(id), ownerId: new Types.ObjectId(ownerId) },
        { $set: input },
        { returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec();

    if (!document) {
      throw new NotFoundException('Book not found');
    }
    return this.toBook(document);
  }

  async remove(ownerId: string, id: string): Promise<Book> {
    const document = await this.books
      .findOneAndDelete({
        _id: this.objectId(id),
        ownerId: new Types.ObjectId(ownerId),
      })
      .lean()
      .exec();

    if (!document) {
      throw new NotFoundException('Book not found');
    }
    return this.toBook(document);
  }

  private async findOwned(ownerId: string, id: string) {
    const document = await this.books
      .findOne({
        _id: this.objectId(id),
        ownerId: new Types.ObjectId(ownerId),
      })
      .lean()
      .exec();

    if (!document) {
      throw new NotFoundException('Book not found');
    }
    return document;
  }

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Book not found');
    }
    return new Types.ObjectId(id);
  }

  private toBook(document: {
    _id: unknown;
    title: string;
    author: string;
    description?: string;
    publishedYear?: number;
    status: Book['status'];
    createdAt: Date;
    updatedAt: Date;
  }): Book {
    return {
      id: String(document._id),
      title: document.title,
      author: document.author,
      ...(document.description ? { description: document.description } : {}),
      ...(document.publishedYear
        ? { publishedYear: document.publishedYear }
        : {}),
      status: document.status,
      createdAt: new Date(document.createdAt).toISOString(),
      updatedAt: new Date(document.updatedAt).toISOString(),
    };
  }
}
