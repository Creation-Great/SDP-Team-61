/**
 * Integration tests for instructor routes.
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
    { user_id: 'u-inst-1', email: 'inst@test.com', role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', jwtid: `jti-inst-${Date.now()}` },
  );
}

function mockAuth(role = 'student') {
  mockPool.query
    .mockResolvedValueOnce({
      rows: [{ user_id: 'u-inst-1', email: 'inst@test.com', name: 'Inst User', role, course_id: 'CSE4939W', group_id: 'G1' }],
    })
    .mockResolvedValueOnce({ rows: [{ enrollment_id: 'e1', course_id: 'CSE4939W', role }] }); // enrollments
}

beforeEach(() => jest.clearAllMocks());

/* ================================================================== */
/*  GET /instructor/overview                                          */
/* ================================================================== */
describe('GET /instructor/overview', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/instructor/overview');
    expect(res.status).toBe(401);
  });

  it('should return 403 for student role', async () => {
    const token = makeToken('student');
    mockAuth('student');

    const res = await request(app)
      .get('/instructor/overview')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('should return overview for instructor', async () => {
    const token = makeToken('instructor');
    mockAuth('instructor');

    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({              // SELECT overview data
        rows: [
          {
            total_students: 25,
            total_submissions: 48,
            pending_reviews: 12,
            active_sessions: 2,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .get('/instructor/overview')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
  });
});

/* ================================================================== */
/*  POST /instructor/assign                                           */
/* ================================================================== */
describe('POST /instructor/assign', () => {
  it('should return 403 for student role', async () => {
    const token = makeToken('student');
    mockAuth('student');

    const res = await request(app)
      .post('/instructor/assign')
      .set('Cookie', `token=${token}`)
      .send({
        submission_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        reviewer_id: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('should return 400 for missing required fields (Zod validation)', async () => {
    const token = makeToken('instructor');
    mockAuth('instructor');

    const res = await request(app)
      .post('/instructor/assign')
      .set('Cookie', `token=${token}`)
      .send({}); // missing submission_id and reviewer_id

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });
});
