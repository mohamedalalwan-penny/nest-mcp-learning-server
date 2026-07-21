import { Injectable } from '@nestjs/common';

export interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
}

@Injectable()
export class JsonPlaceholderService {
  private readonly baseUrl = 'https://jsonplaceholder.typicode.com';
  private readonly timeoutMs = 5_000;

  async listPosts(userId: number | undefined, limit: number): Promise<Post[]> {
    const url = new URL('/posts', this.baseUrl);

    if (userId !== undefined) {
      url.searchParams.set('userId', String(userId));
    }

    const posts = await this.getJson<Post[]>(url);
    return posts.slice(0, limit);
  }

  async getPost(id: number): Promise<Post> {
    return this.getJson<Post>(new URL(`/posts/${id}`, this.baseUrl));
  }

  async getUser(id: number): Promise<User> {
    return this.getJson<User>(new URL(`/users/${id}`, this.baseUrl));
  }

  private async getJson<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`JSONPlaceholder returned HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('JSONPlaceholder request timed out');
      }

      throw new Error('JSONPlaceholder request failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}
