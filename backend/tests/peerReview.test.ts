/**
 * Integration tests for peer review routes.
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
    { user_id: 'u-pr-1', email: 'pr@test.com', role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', jwtid: `jti-pr-${Date.now()}` },
  );
}

function mockAuth(role = 'student') {
  mockPool.query
    .mockResolvedValueOnce({
      rows: [{ user_id: 'u-pr-1', email: 'pr@test.com', name: 'PR User', role, course_id: 'CSE4939W', group_id: 'G1' }],
    })
    .mockResolvedValueOnce({ rows: [{ enrollment_id: 'e1', course_id: 'CSE4939W', role }] }); // enrollments
}

beforeEach(() => jest.clearAllMocks());

/* ================================================================== */
/*  GET /peer-review/sessions                                         */
/* ================================================================== */
describe('GET /peer-review/sessions', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/peer-review/sessions');
    expect(res.status).toBe(401);
  });

  it('should return sessions list for authenticated student', async () => {
    const token = makeToken('student');
    mockAuth('student');

    // getSessions makes multiple client.query calls within withDb callback.
    // Default mock resolves to empty rows for any unmatched call.
    mockClient.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/peer-review/sessions')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should return sessions list for instructor', async () => {
    const token = makeToken('instructor');
    mockAuth('instructor');

    // Default mock for all queries in getSessions
    mockClient.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/peer-review/sessions')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

/* ================================================================== */
/*  POST /peer-review/sessions (instructor only)                      */
/* ================================================================== */
describe('POST /peer-review/sessions', () => {
  it('should return 403 for student role', async () => {
    const token = makeToken('student');
    mockAuth('student');

    const res = await request(app)
      .post('/peer-review/sessions')
      .set('Cookie', `token=${token}`)
      .send({ title: 'New Session', course_id: 'CSE4939W' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('should create session with valid data for instructor', async () => {
    const token = makeToken('instructor');
    mockAuth('instructor');

    // createSession makes INSERT query within withDb callback
    mockClient.query.mockResolvedValue({
      rows: [{
        session_id: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff',
        title: 'Sprint 2 Review',
        course_id: 'CSE4939W',
        is_open: false,
        deadline: null,
        created_at: '2026-03-28T12:00:00Z',
      }],
    });

    const res = await request(app)
      .post('/peer-review/sessions')
      .set('Cookie', `token=${token}`)
      .send({ title: 'Sprint 2 Review', course_id: 'CSE4939W' });

    expect([200, 201]).toContain(res.status);
  });
});

/* ================================================================== */
/*  GET /peer-review/sessions/:sessionId/my-team — param validation   */
/* ================================================================== */
describe('GET /peer-review/sessions/:sessionId/my-team', () => {
  it('should return 400 for invalid UUID param', async () => {
    const token = makeToken('student');
    mockAuth('student');

    const res = await request(app)
      .get('/peer-review/sessions/not-a-uuid/my-team')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(400);
  });
});
