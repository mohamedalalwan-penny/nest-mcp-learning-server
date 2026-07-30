import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { LoginRequest, LoginResponse, User } from '@books/contracts';

import { apiUrl } from './api-url';

const TOKEN_KEY = 'books-poc-token';
const USER_KEY = 'books-poc-user';
const EXPIRY_SAFETY_WINDOW_MS = 30_000;
const MAX_TIMER_DELAY_MS = 2_147_000_000;

export const AUTH_SESSION_ENDED_EVENT = 'books-poc:session-ended';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tokenState = signal(localStorage.getItem(TOKEN_KEY));
  private readonly userState = signal<User | null>(this.readUser());
  private expirationTimer?: ReturnType<typeof setTimeout>;
  private redirectingToLogin = false;

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.tokenState()));

  constructor() {
    this.scheduleExpiration(this.tokenState());
    const checkSession = (): void => {
      this.validToken();
    };
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', checkSession);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', checkSession);
      this.clearExpirationTimer();
    });
  }

  token(): string | null {
    return this.tokenState();
  }

  validToken(returnUrl?: string): string | null {
    const token = this.tokenState();
    if (!token) {
      return null;
    }
    const expiresAt = this.readExpiration(token);
    if (
      expiresAt === null ||
      expiresAt <= Date.now() + EXPIRY_SAFETY_WINDOW_MS
    ) {
      this.handleUnauthorized(returnUrl);
      return null;
    }
    return token;
  }

  async login(input: LoginRequest, returnUrl?: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<LoginResponse>(apiUrl('/api/auth/login'), input),
    );
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    this.tokenState.set(result.accessToken);
    this.userState.set(result.user);
    this.redirectingToLogin = false;
    this.scheduleExpiration(result.accessToken);
    await this.router.navigateByUrl(this.safeReturnUrl(returnUrl) ?? '/books');
  }

  logout(): void {
    this.clearSession();
    window.dispatchEvent(new Event(AUTH_SESSION_ENDED_EVENT));
    void this.router.navigateByUrl('/login');
  }

  handleUnauthorized(returnUrl?: string): void {
    if (this.redirectingToLogin || !this.tokenState()) {
      return;
    }
    this.redirectingToLogin = true;
    const destination =
      this.safeReturnUrl(returnUrl ?? this.router.url) ?? '/books';
    this.clearSession();
    window.dispatchEvent(new Event(AUTH_SESSION_ENDED_EVENT));
    void this.router.navigate(['/login'], {
      queryParams: {
        reason: 'expired',
        returnUrl: destination,
      },
      replaceUrl: true,
    });
  }

  private scheduleExpiration(token: string | null): void {
    this.clearExpirationTimer();
    if (!token) {
      return;
    }
    const expiresAt = this.readExpiration(token);
    if (expiresAt === null) {
      queueMicrotask(() => this.handleUnauthorized());
      return;
    }
    const delay = expiresAt - Date.now() - EXPIRY_SAFETY_WINDOW_MS;
    if (delay <= 0) {
      queueMicrotask(() => this.handleUnauthorized());
      return;
    }
    this.expirationTimer = setTimeout(
      () => {
        if (delay > MAX_TIMER_DELAY_MS) {
          this.scheduleExpiration(this.tokenState());
        } else {
          this.handleUnauthorized();
        }
      },
      Math.min(delay, MAX_TIMER_DELAY_MS),
    );
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
    this.userState.set(null);
    this.clearExpirationTimer();
  }

  private clearExpirationTimer(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = undefined;
    }
  }

  private readExpiration(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }
      const normalized = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const decoded = JSON.parse(atob(normalized)) as { exp?: unknown };
      return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private safeReturnUrl(value?: string): string | null {
    if (
      !value ||
      !value.startsWith('/') ||
      value.startsWith('//') ||
      value.startsWith('/login')
    ) {
      return null;
    }
    return value;
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
