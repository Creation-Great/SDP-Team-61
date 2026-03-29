/**
 * Integration tests for assignment-template routes.
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
    { expiresIn: '1h', jwtid: 'jti-template-test' },
  );
}

function mockAuth(role = 'student') {
  mockPool.query
    .mockResolvedValueOnce({
      rows: [{ user_id: 'u-test-1', email: 'test@example.com', name: 'Test', role }],
    })
    .mockResolvedValueOnce({ rows: [] }); // enrollments
}

/* ================================================================== */
/*  GET /assignment-templates                                          */
/* ================================================================== */
describe('GET /assignment-templates', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).get('/assignment-templates');
    expect(res.status).toBe(401);
  });

  it('should return 200 with array for authenticated user', async () => {
    mockAuth();
    const token = makeToken();

    // Controller query via withDb
    mockClient.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/assignment-templates')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

/* ================================================================== */
/*  POST /assignment-templates                                         */
/* ================================================================== */
describe('POST /assignment-templates', () => {
  it('should return 403 for student role', async () => {
    mockAuth('student');
    const token = makeToken('student');

    const res = await request(app)
      .post('/assignment-templates')
      .set('Cookie', `token=${token}`)
      .send({ name: 'Test Template', description: 'desc' });

    expect(res.status).toBe(403);
  });
});
