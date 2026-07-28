import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="grid min-h-screen place-items-center p-6">
      <section
        class="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-emerald-950/5"
      >
        <div
          class="mb-6 grid size-14 place-items-center rounded-2xl bg-emerald-600 text-2xl text-white shadow-lg shadow-emerald-600/20"
        >
          📚
        </div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          MCP learning POC
        </p>
        <h1 class="mt-2 text-3xl font-bold text-slate-900">Welcome back</h1>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          Use the demo account configured in the API environment.
        </p>

        <form class="mt-8 space-y-5" (ngSubmit)="submit()">
          <label class="block">
            <span class="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input
              class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              type="email"
              name="email"
              [(ngModel)]="email"
              autocomplete="email"
              required
            />
          </label>
          <label class="block">
            <span class="mb-2 block text-sm font-semibold text-slate-700">Password</span>
            <input
              class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              type="password"
              name="password"
              [(ngModel)]="password"
              autocomplete="current-password"
              required
            />
          </label>
          @if (error()) {
            <p class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</p>
          }
          <button
            class="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            type="submit"
            [disabled]="busy()"
          >
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  readonly busy = signal(false);
  readonly error = signal('');
  email = '';
  password = '';

  async submit(): Promise<void> {
    if (!this.email || !this.password || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login({ email: this.email, password: this.password });
    } catch {
      this.error.set('Login failed. Check the demo email and password.');
    } finally {
      this.busy.set(false);
    }
  }
}
