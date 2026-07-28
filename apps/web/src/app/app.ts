import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Chatbot } from './chat/chatbot';
import { AuthService } from './core/auth.service';

@Component({
  imports: [RouterOutlet, Chatbot],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
}
