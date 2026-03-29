/**
 * Integration tests for review routes.
 *
 * DB layer is mocked via jest.unstable_mockModule (ESM).
 */
import { jest } from '@jest/globals';
import type { Express } from 'express';

/* ---------- mock DB ---------- */
const mockClient = { query: jest.fn<any>(), release: jest.fn() };
const mockPool = {
  query: jest.fn<any>(),
  connect: jest.fn<any>().mockResolvedValue(mockClient),
  on: jest.fn(),
  end: jest.fn(),
};
const withDb = jest.fn<any>(async (_u: string, _r: string, cb: any) => cb(mockClient));
const withDbNoRLS = jest.fn<any>(async (cb: any) => cb(mockClient));

jest.unstable_mockModule('../src/db.js', () => ({
  pool: mockPool,
  withDb,
  withDbNoRLS,
}));

/* ---------- dynamic imports ---------- */
let app: Express;
let request: (typeof import('supertest'))['default'];
let jwt: typeof import('jsonwebtoken');

beforeAll(async () => {
  const appMod = await import('../src/app.js');
  app = appMod.default;
  const st = await import('supertest');
  request = st.default;
  jwt = (await import('jsonwebtoken')).default as any;
});

beforeEach(() => {
  jest.clearAllMocks();
});

/* ---------- helpers ---------- */
const SECRET = process.env.JWT_SECRET!;

function makeToken(role = 'student') {
  return jwt.sign(
    { user_id: 'u-test-1', email: 'test@example.com', role },
    SECRET,
    { expiresIn: '1h', jwtid: 'jti-review-test' },
  );
}

/** Mock the two auth-middleware pool.query calls (user lookup + enrollments). */
function mockAuth(role = 'student') {
  mockPool.query
    .mockResolvedValueOnce({
      rows: [{ user_id: 'u-test-1', email: 'test@example.com', name: 'Test', role }],
    })
    .mockResolvedValueOnce({ rows: [] }); // enrollments
}

/* ================================================================== */
/*  GET /reviews/:id                                                   */
/* ================================================================== */
describe('GET /reviews/:id', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/reviews/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid UUID', async () => {
    mockAuth();
    const token = makeToken();

    const res = await request(app)
      .get('/reviews/not-a-uuid')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(400);
  });
});

/* ================================================================== */
/*  GET /reviews/by-submission/:submissionId                           */
/* ================================================================== */
describe('GET /reviews/by-submission/:submissionId', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/reviews/by-submission/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
  });
});

/* ================================================================== */
/*  POST /reviews/:id/submit                                           */
/* ================================================================== */
describe('POST /reviews/:id/submit', () => {
  it('should return 400 for missing score', async () => {
    mockAuth();
    const token = makeToken();

    const res = await request(app)
      .post('/reviews/00000000-0000-0000-0000-000000000001/submit')
      .set('Cookie', `token=${token}`)
      .send({}); // missing score

    expect(res.status).toBe(400);
  });
});
