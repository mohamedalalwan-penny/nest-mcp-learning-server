import { consumeSseFrames } from './sse';

describe('consumeSseFrames', () => {
  it('buffers split SSE frames', () => {
    const events: unknown[] = [];
    const remainder = consumeSseFrames(
      'event: delta\ndata: {"type":"delta","del',
      (event) => events.push(event),
    );

    expect(events).toEqual([]);

    const finalRemainder = consumeSseFrames(
      `${remainder}ta":"Hello"}\n\n`,
      (event) => events.push(event),
    );

    expect(finalRemainder).toBe('');
    expect(events).toEqual([{ type: 'delta', delta: 'Hello' }]);
  });

  it('parses several complete events and preserves the final partial frame', () => {
    const events: unknown[] = [];
    const remainder = consumeSseFrames(
      [
        'event: status\ndata: {"type":"status","label":"Reading"}',
        'event: delta\ndata: {"type":"delta","delta":"One"}',
        'event: done\ndata: {"type":"done"',
      ].join('\n\n'),
      (event) => events.push(event),
    );

    expect(events).toEqual([
      { type: 'status', label: 'Reading' },
      { type: 'delta', delta: 'One' },
    ]);
    expect(remainder).toContain('event: done');
  });
});
