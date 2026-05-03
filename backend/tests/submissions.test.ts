/**
 * Integration tests for submission routes.
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

function makeToken(role = 'student') {
  return jwt.sign(
    { user_id: 'u-sub-1', email: 'sub@test.com', role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', jwtid: `jti-sub-${Date.now()}` },
  );
}

function mockAuth(role = 'student') {
  mockPool.query
    .mockResolvedValueOnce({
      rows: [{ user_id: 'u-sub-1', email: 'sub@test.com', name: 'Sub', role, course_id: 'C1', group_id: 'G1' }],
    })
    .mockResolvedValueOnce({ rows: [] }); // enrollments
}

beforeEach(() => jest.clearAllMocks());

/* ================================================================== */
/*  GET /submissions/mine                                             */
/* ================================================================== */
describe('GET /submissions/mine', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/submissions/mine');
    expect(res.status).toBe(401);
  });

  it('should return submissions for authenticated user', async () => {
    const token = makeToken();
    mockAuth();

    // The controller uses withDb → client.query
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({              // SELECT submissions
        rows: [
          { id: 's1', title: 'Test', status: 'submitted' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .get('/submissions/mine')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

/* ================================================================== */
/*  GET /submissions/all (instructor only)                            */
/* ================================================================== */
describe('GET /submissions/all', () => {
  it('should return 403 for student role', async () => {
    const token = makeToken('student');
    mockAuth('student');

    const res = await request(app)
      .get('/submissions/all')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('should allow instructor access', async () => {
    const token = makeToken('instructor');
    mockAuth('instructor');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // SELECT all submissions
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .get('/submissions/all')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
  });
});
