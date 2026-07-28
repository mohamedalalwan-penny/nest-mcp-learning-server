declare global {
  interface Window {
    __BOOKS_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

const configuredApiUrl = window.__BOOKS_CONFIG__?.apiUrl?.trim() ?? '';
const apiBaseUrl = configuredApiUrl.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}
