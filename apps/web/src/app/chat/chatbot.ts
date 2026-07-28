import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';

import { ChatStateService } from './chat-state.service';

type WidgetMode = 'normal' | 'minimized' | 'maximized';

interface WidgetPosition {
  x: number;
  y: number;
}

const POSITION_KEY = 'books-poc-chat-position';
const MODE_KEY = 'books-poc-chat-mode';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [FormsModule, MarkdownComponent],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css',
})
export class Chatbot {
  readonly chat = inject(ChatStateService);
  readonly mode = signal<WidgetMode>(this.readMode());
  readonly position = signal<WidgetPosition>(this.readPosition());
  readonly stickToBottom = signal(true);

  @ViewChild('timeline') private timeline?: ElementRef<HTMLElement>;

  prompt = '';
  private dragStart?: {
    pointerX: number;
    pointerY: number;
    positionX: number;
    positionY: number;
    moved: boolean;
  };
  private ignoreBubbleClick = false;

  constructor() {
    effect(() => {
      this.chat.messages();
      this.chat.status();
      if (this.stickToBottom()) {
        requestAnimationFrame(() => this.scrollToBottom());
      }
    });
  }

  async send(): Promise<void> {
    const value = this.prompt.trim();
    if (!value || this.chat.busy()) {
      return;
    }
    this.prompt = '';
    this.stickToBottom.set(true);
    await this.chat.send(value);
  }

  keydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  useSuggestion(value: string): void {
    this.prompt = value;
    void this.send();
  }

  setMode(mode: WidgetMode): void {
    this.mode.set(mode);
    localStorage.setItem(MODE_KEY, mode);
    if (mode !== 'minimized') {
      this.stickToBottom.set(true);
      requestAnimationFrame(() => this.scrollToBottom());
    }
  }

  restoreFromBubble(): void {
    if (this.ignoreBubbleClick) {
      this.ignoreBubbleClick = false;
      return;
    }
    this.setMode('normal');
  }

  startDrag(event: PointerEvent): void {
    if (
      this.mode() === 'maximized' ||
      (event.target as HTMLElement).closest('button[data-action]')
    ) {
      return;
    }
    event.preventDefault();
    this.dragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      positionX: this.position().x,
      positionY: this.position().y,
      moved: false,
    };
    window.addEventListener('pointermove', this.drag);
    window.addEventListener('pointerup', this.endDrag, { once: true });
  }

  timelineScrolled(): void {
    const element = this.timeline?.nativeElement;
    if (!element) {
      return;
    }
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    this.stickToBottom.set(distance < 80);
  }

  jumpToLatest(): void {
    this.stickToBottom.set(true);
    this.scrollToBottom();
  }

  @HostListener('window:resize')
  resized(): void {
    this.position.update((position) => this.clamp(position));
  }

  private readonly drag = (event: PointerEvent): void => {
    if (!this.dragStart) {
      return;
    }
    const x =
      this.dragStart.positionX + event.clientX - this.dragStart.pointerX;
    const y =
      this.dragStart.positionY + event.clientY - this.dragStart.pointerY;
    if (
      Math.abs(event.clientX - this.dragStart.pointerX) > 4 ||
      Math.abs(event.clientY - this.dragStart.pointerY) > 4
    ) {
      this.dragStart.moved = true;
    }
    this.position.set(this.clamp({ x, y }));
  };

  private readonly endDrag = (): void => {
    window.removeEventListener('pointermove', this.drag);
    if (this.mode() === 'minimized' && this.dragStart?.moved) {
      this.ignoreBubbleClick = true;
    }
    this.dragStart = undefined;
    localStorage.setItem(POSITION_KEY, JSON.stringify(this.position()));
  };

  private clamp(position: WidgetPosition): WidgetPosition {
    const minimized = this.mode() === 'minimized';
    const width = minimized ? 68 : Math.min(420, window.innerWidth - 24);
    const height = minimized ? 68 : Math.min(640, window.innerHeight - 24);
    return {
      x: Math.max(12, Math.min(position.x, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(position.y, window.innerHeight - height - 12)),
    };
  }

  private scrollToBottom(): void {
    const element = this.timeline?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }

  private readMode(): WidgetMode {
    const value = localStorage.getItem(MODE_KEY);
    return value === 'minimized' || value === 'maximized' ? value : 'normal';
  }

  private readPosition(): WidgetPosition {
    const fallback = {
      x: Math.max(12, window.innerWidth - 440),
      y: Math.max(12, window.innerHeight - 660),
    };
    const value = localStorage.getItem(POSITION_KEY);
    if (!value) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(value) as WidgetPosition;
      return this.clamp(parsed);
    } catch {
      return fallback;
    }
  }
}
