import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  Book,
  BookListResponse,
  CreateBookRequest,
  UpdateBookRequest,
} from '@books/contracts';

import { apiUrl } from './api-url';

@Injectable({ providedIn: 'root' })
export class BooksApiService {
  private readonly http = inject(HttpClient);

  list(q = '', status = ''): Promise<BookListResponse> {
    let params = new HttpParams();
    if (q.trim()) {
      params = params.set('q', q.trim());
    }
    if (status) {
      params = params.set('status', status);
    }
    return firstValueFrom(
      this.http.get<BookListResponse>(apiUrl('/api/books'), { params }),
    );
  }

  create(input: CreateBookRequest): Promise<Book> {
    return firstValueFrom(this.http.post<Book>(apiUrl('/api/books'), input));
  }

  update(id: string, input: UpdateBookRequest): Promise<Book> {
    return firstValueFrom(
      this.http.patch<Book>(apiUrl(`/api/books/${id}`), input),
    );
  }

  remove(id: string): Promise<Book> {
    return firstValueFrom(this.http.delete<Book>(apiUrl(`/api/books/${id}`)));
  }
}
