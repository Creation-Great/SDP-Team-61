/**
 * Integration tests for auth routes — register, login, logout, getMe.
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

/* ================================================================== */
/*  POST /auth/register                                               */
/* ================================================================== */
describe('POST /auth/register', () => {
  it('should register a new user (201)', async () => {
    // withDbNoRLS mock calls cb(mockClient) directly (no BEGIN/COMMIT)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })           // dup check => no rows
      .mockResolvedValueOnce({                        // INSERT
        rows: [{ user_id: 'u1', email: 'new@test.com', name: 'New', role: 'student' }],
      });

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'New', email: 'new@test.com', password: 'Password1!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user_id');
  });

  it('should reject weak validation (missing fields)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'x' }); // missing name, password

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });

  it('should return 409 if email already exists', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u-existing' }] }); // dup check finds one

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Dup', email: 'dup@test.com', password: 'Password1!' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('conflict');
  });
});

/* ================================================================== */
/*  POST /auth/login                                                  */
/* ================================================================== */
describe('POST /auth/login', () => {
  it('should return 401 for unknown email', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] });   // SELECT user => not found

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'pass123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('should reject missing body fields', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

/* ================================================================== */
/*  POST /auth/logout                                                 */
/* ================================================================== */
describe('POST /auth/logout', () => {
  it('should clear cookie and return success', async () => {
    const res = await request(app)
      .post('/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    // Should have Set-Cookie clearing the token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });
});

/* ================================================================== */
/*  GET /auth/me                                                      */
/* ================================================================== */
describe('GET /auth/me', () => {
  it('should return 401 without auth cookie', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return user info with valid JWT cookie', async () => {
    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign(
      { user_id: 'u-me', email: 'me@test.com', role: 'student' },
      secret,
      { expiresIn: '1h', jwtid: 'jti-me' },
    );

    // Auth middleware uses pool.query directly (not withDb)
    mockPool.query
      .mockResolvedValueOnce({               // SELECT user
        rows: [{ user_id: 'u-me', email: 'me@test.com', name: 'Me', role: 'student', course_id: 'C1', group_id: 'G1' }],
      })
      .mockResolvedValueOnce({ rows: [] });  // enrollments

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'u-me');
    expect(res.body).toHaveProperty('email', 'me@test.com');
  });
});
