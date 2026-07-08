import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, fetchText, USER_AGENT } from '../src/lib/http.js';

afterEach(() => vi.restoreAllMocks());

describe('http', () => {
  it('exposes a UA identifying the bot with contact info', () => {
    expect(USER_AGENT).toMatch(/startup-pulse-bot/);
    expect(USER_AGENT).toMatch(/brian\.boler340@gmail\.com/);
  });

  it('fetchJson sends UA header and parses JSON', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), { status: 200 })
    );
    const result = await fetchJson('https://example.com/api');
    expect(result).toEqual({ ok: 1 });
    const [, opts] = mock.mock.calls[0];
    expect(opts.headers['User-Agent']).toBe(USER_AGENT);
  });

  it('retries on 500 then succeeds', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('hello', { status: 200 }));
    const text = await fetchText('https://example.com', {}, { retryDelayMs: 1 });
    expect(text).toBe('hello');
  });

  it('throws after 3 failed attempts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 500 }));
    await expect(fetchText('https://example.com', {}, { retryDelayMs: 1 }))
      .rejects.toThrow(/500/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});
