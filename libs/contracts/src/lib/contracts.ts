export const BOOK_STATUSES = ['to_read', 'reading', 'read'] as const;

export type BookStatus = (typeof BOOK_STATUSES)[number];

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  publishedYear?: number;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookRequest {
  title: string;
  author: string;
  description?: string;
  publishedYear?: number;
  status?: BookStatus;
}

export interface UpdateBookRequest {
  title?: string;
  author?: string;
  description?: string;
  publishedYear?: number;
  status?: BookStatus;
}

export interface BookListResponse {
  books: Book[];
  total: number;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
}

export interface AssistantChatRequest {
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>;
}

export type AssistantStreamEvent =
  | { type: 'status'; label: string; tool?: string }
  | { type: 'delta'; delta: string }
  | { type: 'done'; message: string; changedBooks: boolean }
  | { type: 'error'; message: string };
