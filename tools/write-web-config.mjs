import { writeFile } from 'node:fs/promises';

const apiUrl = process.env.API_URL?.trim().replace(/\/+$/, '');
if (!apiUrl) {
  throw new Error('API_URL is required when building the hosted frontend');
}

await writeFile(
  new URL('../apps/web/public/runtime-config.js', import.meta.url),
  `window.__BOOKS_CONFIG__ = ${JSON.stringify({ apiUrl }, null, 2)};\n`,
);

console.log(`Angular runtime API configured for ${apiUrl}`);
