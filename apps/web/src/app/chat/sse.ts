import type { AssistantStreamEvent } from '@books/contracts';

export function consumeSseFrames(
  value: string,
  onEvent: (event: AssistantStreamEvent) => void,
): string {
  const frames = value.split(/\r?\n\r?\n/);
  const remainder = frames.pop() ?? '';

  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) {
      continue;
    }
    onEvent(JSON.parse(data) as AssistantStreamEvent);
  }
  return remainder;
}
