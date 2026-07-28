import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen">
      <header
        class="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur"
      >
        <div
          class="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8"
        >
          <a class="flex items-center gap-3" routerLink="/books">
            <div
              class="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-xl text-white"
            >
              📚
            </div>
            <div>
              <h1 class="font-bold text-slate-900">Books MCP POC</h1>
              <p class="text-xs text-slate-500">Architecture guide</p>
            </div>
          </a>
          <div class="flex items-center gap-3">
            <a
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              routerLink="/books"
            >
              Back to books
            </a>
            <button
              class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              (click)="auth.logout()"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <p class="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
          One service, two interfaces
        </p>
        <h2 class="mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900">
          Manual CRUD and AI chat operate on the same application capabilities.
        </h2>
        <p class="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Navigate between this page and the collection while the assistant is open.
          Its state and conversation persist because it lives once in the Angular
          application shell.
        </p>

        <div class="mt-10 grid gap-5 md:grid-cols-2">
          @for (step of steps; track step.title) {
            <article
              class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span
                class="grid size-10 place-items-center rounded-xl bg-emerald-50 font-bold text-emerald-700"
              >
                {{ step.number }}
              </span>
              <h3 class="mt-5 text-xl font-bold text-slate-900">{{ step.title }}</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ step.description }}</p>
            </article>
          }
        </div>
      </main>
    </div>
  `,
})
export class AboutPage {
  readonly auth = inject(AuthService);
  readonly steps = [
    {
      number: '1',
      title: 'Angular REST interface',
      description:
        'The books form calls authenticated NestJS REST endpoints documented with Swagger.',
    },
    {
      number: '2',
      title: 'Persistent assistant',
      description:
        'The draggable Angular widget streams Markdown responses and survives route changes.',
    },
    {
      number: '3',
      title: 'Real MCP client',
      description:
        'The assistant connects over Streamable HTTP and forwards the current user JWT.',
    },
    {
      number: '4',
      title: 'Shared BooksService',
      description:
        'REST controllers and MCP tools call the same owner-scoped service backed by MongoDB.',
    },
  ];
}
