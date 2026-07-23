import { describe, it, expect, beforeEach, vi } from 'vitest';

const originalEnv = process.env;

function createRequest(opts: { origin?: string; referer?: string; host?: string; apiKey?: string } = {}): Request {
  const headers = new Headers();
  if (opts.origin) headers.set('origin', opts.origin);
  if (opts.referer) headers.set('referer', opts.referer);
  if (opts.host) headers.set('host', opts.host);
  if (opts.apiKey) headers.set('x-api-key', opts.apiKey);
  return new Request('http://localhost', { headers });
}

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.APP_DOMAIN;
  });

  it('should return valid + isSameOrigin when API_SECRET_KEY is not set (dev mode)', async () => {
    delete process.env.API_SECRET_KEY;
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest());
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(true);
  });

  it('should allow same-origin request via Host header (when APP_DOMAIN not set)', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    delete process.env.APP_DOMAIN;
    const { validateApiKey } = await import('../api-auth');
    // APP_DOMAIN tidak diset, Host header ada → fallback ke Host
    const result = validateApiKey(createRequest({ host: 'localhost:3000' }));
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(true);
  });

  it('should allow same-origin via Host matching APP_DOMAIN domain', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    // Host header domain "localhost" matches APP_DOMAIN "http://localhost:3000" → "localhost"
    const result = validateApiKey(createRequest({ host: 'localhost:3000' }));
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(true);
  });

  it('should allow same-origin with matching Origin header + isSameOrigin=true', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({ host: 'localhost:3000', origin: 'http://localhost:3000' }));
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(true);
  });

  it('should allow same-origin via Referer + isSameOrigin=true', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({ host: 'localhost:3000', referer: 'http://localhost:3000/page' }));
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(true);
  });

  it('should reject external request without API key', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({ origin: 'https://external-site.com' }));
    expect(result.valid).toBe(false);
    expect(result.isSameOrigin).toBe(false);
    expect(result.error).toContain('X-API-Key');
  });

  it('should reject external request with wrong API key', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({ origin: 'https://external-site.com', apiKey: 'wrong-key' }));
    expect(result.valid).toBe(false);
    expect(result.isSameOrigin).toBe(false);
    expect(result.error).toContain('tidak valid');
  });

  it('should allow external request with correct API key + isSameOrigin=false', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({ origin: 'https://external-site.com', apiKey: 'test-secret-123' }));
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(false);
  });

  it('should respect APP_DOMAIN env var', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'https://viraloop.vercel.app';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({ origin: 'https://viraloop.vercel.app' }));
    expect(result.valid).toBe(true);
    expect(result.isSameOrigin).toBe(true);
  });

  it('should reject request with no Origin, Referer, or Host headers', async () => {
    process.env.API_SECRET_KEY = 'test-secret-123';
    process.env.APP_DOMAIN = 'http://localhost:3000';
    const { validateApiKey } = await import('../api-auth');
    const result = validateApiKey(createRequest({}));
    expect(result.valid).toBe(false);
    expect(result.isSameOrigin).toBe(false);
    expect(result.error).toContain('X-API-Key');
  });
});