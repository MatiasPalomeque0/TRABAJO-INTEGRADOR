import { describe, expect, it } from 'vitest';
import { createSingleFlight } from './single-flight';

describe('single-flight de recargas', () => {
  it('comparte una solicitud cuando foco y pull-to-refresh ocurren juntos', async () => {
    const flight = createSingleFlight<string>();
    let calls = 0;
    let resolveRequest!: (value: string) => void;
    const request = () => {
      calls += 1;
      return new Promise<string>((resolve) => { resolveRequest = resolve; });
    };

    const first = flight.run(request);
    const second = flight.run(request);
    expect(first).toBe(second);
    await Promise.resolve();
    expect(calls).toBe(1);
    resolveRequest('estado actualizado');
    await expect(first).resolves.toBe('estado actualizado');
  });

  it('permite una nueva recarga después de finalizar la anterior', async () => {
    const flight = createSingleFlight<number>();
    let calls = 0;
    const request = async () => ++calls;

    await expect(flight.run(request)).resolves.toBe(1);
    await expect(flight.run(request)).resolves.toBe(2);
  });
});
