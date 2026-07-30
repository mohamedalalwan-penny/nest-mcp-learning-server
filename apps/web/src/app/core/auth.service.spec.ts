import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

function tokenExpiringAt(expiresAt: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(expiresAt / 1000) }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

describe('AuthService', () => {
  const router = {
    url: '/books',
    navigate: vi.fn().mockResolvedValue(true),
    navigateByUrl: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    localStorage.clear();
    router.navigate.mockClear();
    router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: HttpClient, useValue: {} },
        { provide: Router, useValue: router },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('accepts a stored unexpired JWT', () => {
    const token = tokenExpiringAt(Date.now() + 3_600_000);
    localStorage.setItem('books-poc-token', token);

    const auth = TestBed.inject(AuthService);

    expect(auth.validToken()).toBe(token);
    expect(auth.isAuthenticated()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears an expired JWT and redirects back through login once', async () => {
    localStorage.setItem(
      'books-poc-token',
      tokenExpiringAt(Date.now() - 60_000),
    );
    localStorage.setItem(
      'books-poc-user',
      JSON.stringify({
        id: 'reader-1',
        email: 'reader@example.com',
        displayName: 'Reader',
      }),
    );

    const auth = TestBed.inject(AuthService);
    expect(auth.validToken('/about')).toBeNull();
    auth.handleUnauthorized('/books');
    await Promise.resolve();

    expect(localStorage.getItem('books-poc-token')).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: {
        reason: 'expired',
        returnUrl: '/about',
      },
      replaceUrl: true,
    });
  });
});
