/**
 * Integration tests for AI controller routes — feedback, polish, search.
 *
 * DB layer is mocked via jest.unstable_mockModule (ESM).
 * global.fetch is mocked to intercept calls to the AI service.
 */
import { jest } from '@jest/globals';
import type { Express } from 'express';

/* ---------- mock fetch ---------- */
const mockFetch = jest.fn() as jest.Mock;
(global as any).fetch = mockFetch;

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
  mockFetch.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helper: create a valid JWT and set up auth DB queries              */
/* ------------------------------------------------------------------ */
const TEST_SECRET = process.env.JWT_SECRET!;

function makeToken(overrides: Record<string, string> = {}): string {
  return jwt.sign(
    {
      user_id: overrides.user_id ?? 'u-ai-tester',
      email: overrides.email ?? 'ai@test.com',
      role: overrides.role ?? 'student',
    },
    TEST_SECRET,
    { expiresIn: '1h', jwtid: 'jti-ai-1' },
  );
}

/**
 * The authenticate middleware does two pool.query calls:
 *   1. SELECT user from users
 *   2. SELECT enrollments from user_enrollments
 * Mock both so the request passes authentication.
 */
function setupAuthQueries(): void {
  mockPool.query
    .mockResolvedValueOnce({
      rows: [{ user_id: 'u-ai-tester', email: 'ai@test.com', name: 'Tester', role: 'student', course_id: 'C1', group_id: 'G1' }],
    })
    .mockResolvedValueOnce({ rows: [] }); // enrollments
}

/* ================================================================== */
/*  POST /api/ai/feedback                                             */
/* ================================================================== */
describe('POST /api/ai/feedback', () => {
  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/ai/feedback')
      .send({ review_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', text: 'Good work' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('should return 400 when review_id or text is missing', async () => {
    setupAuthQueries();
    const token = makeToken();

    const res = await request(app)
      .post('/api/ai/feedback')
      .set('Cookie', `token=${token}`)
      .send({ text: 'only text, no review_id' });

    expect(res.status).toBe(400);
  });

  it('should proxy to AI service and return result (200)', async () => {
    setupAuthQueries();
    const token = makeToken();

    // Mock the AI service fetch call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ toxicity: 0.1, politeness: 0.9, sentiment: 'positive', review_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }),
    });

    // withDb is called by notifyAiComplete — mock client.query for the notification insert
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });

    const res = await request(app)
      .post('/api/ai/feedback')
      .set('Cookie', `token=${token}`)
      .send({ review_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', text: 'Excellent research methodology' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('toxicity', 0.1);
    expect(res.body).toHaveProperty('sentiment', 'positive');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Verify the fetch was called with the correct AI service URL
    expect(mockFetch.mock.calls[0][0]).toContain('/api/ai/feedback');
  });

  it('should return 504 on AI service timeout (AbortError)', async () => {
    setupAuthQueries();
    const token = makeToken();

    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    const res = await request(app)
      .post('/api/ai/feedback')
      .set('Cookie', `token=${token}`)
      .send({ review_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', text: 'Some review text' });

    expect(res.status).toBe(504);
  });
});

/* ================================================================== */
/*  POST /api/ai/polish                                               */
/* ================================================================== */
describe('POST /api/ai/polish', () => {
  it('should return 400 when text is missing', async () => {
    setupAuthQueries();
    const token = makeToken();

    const res = await request(app)
      .post('/api/ai/polish')
      .set('Cookie', `token=${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

/* ================================================================== */
/*  GET /api/ai/search                                                */
/* ================================================================== */
describe('GET /api/ai/search', () => {
  it('should return 400 when q is missing', async () => {
    setupAuthQueries();
    const token = makeToken();

    const res = await request(app)
      .get('/api/ai/search')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(400);
  });

  it('should proxy search to AI service and return results (200)', async () => {
    setupAuthQueries();
    const token = makeToken();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ submissions: [{ submission_id: 's1', title: 'Test Paper' }], users: [] }),
    });

    const res = await request(app)
      .get('/api/ai/search?q=test')
      .set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('submissions');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/search');
    expect(mockFetch.mock.calls[0][0]).toContain('q=test');
  });
});
