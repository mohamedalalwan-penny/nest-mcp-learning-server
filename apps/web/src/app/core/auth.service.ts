import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { LoginRequest, LoginResponse, User } from '@books/contracts';

import { apiUrl } from './api-url';

const TOKEN_KEY = 'books-poc-token';
const USER_KEY = 'books-poc-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenState = signal(localStorage.getItem(TOKEN_KEY));
  private readonly userState = signal<User | null>(this.readUser());

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.tokenState()));

  token(): string | null {
    return this.tokenState();
  }

  async login(input: LoginRequest): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<LoginResponse>(apiUrl('/api/auth/login'), input),
    );
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    this.tokenState.set(result.accessToken);
    this.userState.set(result.user);
    await this.router.navigateByUrl('/books');
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
    this.userState.set(null);
    void this.router.navigateByUrl('/login');
  }

  private readUser(): User | null {
    const value = localStorage.getItem(USER_KEY);
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as User;
    } catch {
      return null;
    }
  }
}
