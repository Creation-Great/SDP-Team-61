/**
 * Integration tests for the Express app — healthz, error handling, CORS.
 *
 * Uses jest.unstable_mockModule to mock the DB layer before importing
 * the app (required for ESM).
 */
import { jest } from '@jest/globals';
import type { Express } from 'express';
import type { MockPool, MockClient } from './helpers.js';

/* ---------- mock DB before importing app ---------- */
const mockClient: MockClient = { query: jest.fn() as any, release: jest.fn() as any };
const mockPool: MockPool = {
  query: jest.fn() as any,
  connect: jest.fn<any>().mockResolvedValue(mockClient),
  on: jest.fn() as any,
  end: jest.fn() as any,
};
const withDb = jest.fn<any>(async (_u: string, _r: string, cb: any) => cb(mockClient));
const withDbNoRLS = jest.fn<any>(async (cb: any) => cb(mockClient));

jest.unstable_mockModule('../src/db.js', () => ({
  pool: mockPool,
  withDb,
  withDbNoRLS,
}));

/* ---------- dynamic imports (after mock) ---------- */
let app: Express;
let request: (typeof import('supertest'))['default'];

beforeAll(async () => {
  const appMod = await import('../src/app.js');
  app = appMod.default;
  const supertestMod = await import('supertest');
  request = supertestMod.default;
});

/* ---------- tests ---------- */
describe('GET /healthz', () => {
  it('should return { ok: true }', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('Global error handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent-route-xyz');
    // Express 5 returns 404 by default for unmatched routes
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('should allow the configured origin', async () => {
    const res = await request(app)
      .get('/healthz')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('should deny disallowed origins', async () => {
    const res = await request(app)
      .get('/healthz')
      .set('Origin', 'http://evil.com');
    // CORS middleware blocks via error or omits header
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Rate limiting', () => {
  it('should include rate-limit headers', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers).toHaveProperty('ratelimit-limit');
  });
});
