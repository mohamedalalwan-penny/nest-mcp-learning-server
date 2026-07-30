import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import type {
  AssistantChatRequest,
  AssistantStreamEvent,
  ChatMessage,
} from '@books/contracts';

import { AUTH_SESSION_ENDED_EVENT, AuthService } from '../core/auth.service';
import { apiUrl } from '../core/api-url';
import { consumeSseFrames } from './sse';

const CHAT_KEY = 'books-poc-chat';

@Injectable({ providedIn: 'root' })
export class ChatStateService {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageState = signal<ChatMessage[]>(this.loadMessages());
  private readonly statusState = signal('');
  private readonly busyState = signal(false);
  private readonly booksVersionState = signal(0);
  private abortController?: AbortController;

  readonly messages = this.messageState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly booksVersion = this.booksVersionState.asReadonly();
  readonly hasMessages = computed(() => this.messageState().length > 0);

  constructor() {
    const clearSessionChat = (): void => this.clear();
    window.addEventListener(AUTH_SESSION_ENDED_EVENT, clearSessionChat);
    this.destroyRef.onDestroy(() =>
      window.removeEventListener(AUTH_SESSION_ENDED_EVENT, clearSessionChat),
    );
  }

  clear(): void {
    this.abortController?.abort();
    this.messageState.set([]);
    this.statusState.set('');
    this.busyState.set(false);
    localStorage.removeItem(CHAT_KEY);
  }

  cancel(): void {
    this.abortController?.abort();
  }

  async send(content: string): Promise<void> {
    const query = content.trim();
    const token = this.auth.validToken();
    if (!query || !token || this.busyState()) {
      return;
    }

    const userMessage = this.makeMessage('user', query);
    this.messageState.update((messages) => [...messages, userMessage]);
    this.persist();
    this.busyState.set(true);
    this.statusState.set('Connecting…');
    this.abortController = new AbortController();
    let assistantId: string | undefined;
    let buffer = '';

    const payload: AssistantChatRequest = {
      messages: this.messageState()
        .filter((message) => !message.error && !message.pending)
        .map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
    };

    try {
      const response = await fetch(apiUrl('/api/assistant/chat'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
      });
      if (response.status === 401) {
        this.auth.handleUnauthorized();
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`Assistant request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        buffer = consumeSseFrames(buffer, (event) => {
          assistantId = this.applyEvent(event, assistantId);
        });
        if (done) {
          break;
        }
      }
      if (buffer.trim()) {
        consumeSseFrames(`${buffer}\n\n`, (event) => {
          assistantId = this.applyEvent(event, assistantId);
        });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.addError(
          'The assistant could not complete that request. Check that the API, MongoDB, and Gemini credentials are running.',
          assistantId,
        );
      }
    } finally {
      this.busyState.set(false);
      this.statusState.set('');
      this.abortController = undefined;
      this.persist();
    }
  }

  private applyEvent(
    event: AssistantStreamEvent,
    assistantId?: string,
  ): string | undefined {
    if (event.type === 'status') {
      this.statusState.set(event.label);
      return assistantId;
    }

    if (event.type === 'delta' && event.delta) {
      if (!assistantId) {
        const message = this.makeMessage('assistant', event.delta, true);
        assistantId = message.id;
        this.messageState.update((messages) => [...messages, message]);
      } else {
        const id = assistantId;
        this.messageState.update((messages) =>
          messages.map((message) =>
            message.id === id
              ? { ...message, content: message.content + event.delta }
              : message,
          ),
        );
      }
      return assistantId;
    }

    if (event.type === 'done') {
      if (event.message && !assistantId) {
        const message = this.makeMessage('assistant', event.message);
        assistantId = message.id;
        this.messageState.update((messages) => [...messages, message]);
      } else if (assistantId) {
        const id = assistantId;
        this.messageState.update((messages) =>
          messages.map((message) =>
            message.id === id ? { ...message, pending: false } : message,
          ),
        );
      }
      if (event.changedBooks) {
        this.booksVersionState.update((version) => version + 1);
      }
      this.persist();
      return assistantId;
    }

    if (event.type === 'error') {
      this.addError(event.message, assistantId);
    }
    return assistantId;
  }

  private addError(message: string, assistantId?: string): void {
    this.messageState.update((messages) => [
      ...messages.filter((item) => item.id !== assistantId),
      { ...this.makeMessage('assistant', message), error: true },
    ]);
  }

  private makeMessage(
    role: ChatMessage['role'],
    content: string,
    pending = false,
  ): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
      pending,
    };
  }

  private persist(): void {
    const messages = this.messageState().slice(-40);
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }

  private loadMessages(): ChatMessage[] {
    const value = localStorage.getItem(CHAT_KEY);
    if (!value) {
      return [];
    }
    try {
      const messages = JSON.parse(value) as ChatMessage[];
      return Array.isArray(messages) ? messages.slice(-40) : [];
    } catch {
      return [];
    }
  }
}
