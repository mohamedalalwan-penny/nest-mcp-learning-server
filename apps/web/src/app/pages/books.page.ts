import {
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type {
  Book,
  BookStatus,
  CreateBookRequest,
} from '@books/contracts';
import { BOOK_STATUSES } from '@books/contracts';

import { ChatStateService } from '../chat/chat-state.service';
import { AuthService } from '../core/auth.service';
import { BooksApiService } from '../core/books-api.service';

interface BookForm {
  title: string;
  author: string;
  description: string;
  publishedYear: number | null;
  status: BookStatus;
}

const emptyForm = (): BookForm => ({
  title: '',
  author: '',
  description: '',
  publishedYear: null,
  status: 'to_read',
});

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './books.page.html',
})
export class BooksPage {
  private readonly api = inject(BooksApiService);
  private readonly chat = inject(ChatStateService);
  readonly auth = inject(AuthService);
  readonly statuses = BOOK_STATUSES;
  readonly books = signal<Book[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);

  query = '';
  status = '';
  form = emptyForm();

  constructor() {
    effect(() => {
      this.chat.booksVersion();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.list(this.query, this.status);
      this.books.set(result.books);
    } catch {
      this.error.set('Books could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  edit(book: Book): void {
    this.editingId.set(book.id);
    this.form = {
      title: book.title,
      author: book.author,
      description: book.description ?? '',
      publishedYear: book.publishedYear ?? null,
      status: book.status,
    };
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form = emptyForm();
  }

  async save(): Promise<void> {
    if (!this.form.title.trim() || !this.form.author.trim() || this.saving()) {
      return;
    }
    this.saving.set(true);
    const input: CreateBookRequest = {
      title: this.form.title.trim(),
      author: this.form.author.trim(),
      status: this.form.status,
      ...(this.form.description.trim()
        ? { description: this.form.description.trim() }
        : {}),
      ...(this.form.publishedYear
        ? { publishedYear: this.form.publishedYear }
        : {}),
    };

    try {
      const id = this.editingId();
      if (id) {
        await this.api.update(id, input);
      } else {
        await this.api.create(input);
      }
      this.resetForm();
      await this.load();
    } catch {
      this.error.set('The book could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(book: Book): Promise<void> {
    if (!confirm(`Delete “${book.title}”?`)) {
      return;
    }
    try {
      await this.api.remove(book.id);
      await this.load();
    } catch {
      this.error.set('The book could not be deleted.');
    }
  }

  statusLabel(value: BookStatus): string {
    return value.replace('_', ' ');
  }
}
