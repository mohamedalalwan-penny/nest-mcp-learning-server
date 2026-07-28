import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { BooksPage } from './pages/books.page';
import { LoginPage } from './pages/login.page';
import { AboutPage } from './pages/about.page';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage },
  { path: 'books', component: BooksPage, canActivate: [authGuard] },
  { path: 'about', component: AboutPage, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'books' },
  { path: '**', redirectTo: 'books' },
];
