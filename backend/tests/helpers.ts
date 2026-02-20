/**
 * Shared test helpers.
 *
 * Because the project uses ESM (`"type":"module"`), mocking must be done
 * via `jest.unstable_mockModule` *before* any dynamic `import()` of the
 * modules under test.  This file provides ready-made mock factories.
 */

/* ------------------------------------------------------------------ */
/*  Mock pool / withDb / withDbNoRLS                                  */
/* ------------------------------------------------------------------ */

export interface MockPool {
  query: jest.Mock;
  connect: jest.Mock;
  on: jest.Mock;
  end: jest.Mock;
}

export interface MockClient {
  query: jest.Mock;
  release: jest.Mock;
}

export function createMockClient(): MockClient {
  return { query: jest.fn(), release: jest.fn() };
}

export function createMockPool(client?: MockClient): MockPool {
  const c = client ?? createMockClient();
  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(c),
    on: jest.fn(),
    end: jest.fn(),
  };
}

/**
 * Call `jest.unstable_mockModule` for `../src/db` (or the path you pass).
 * Returns the mock objects so you can configure per-test behaviour.
 */
export function mockDbModule(modulePath = '../../src/db') {
  const mockClient = createMockClient();
  const mockPool = createMockPool(mockClient);

  // withDb / withDbNoRLS execute the callback with the mock client
  const withDb = jest.fn(
    async <T>(_userId: string, _role: string, cb: (c: MockClient) => Promise<T>) => cb(mockClient),
  );
  const withDbNoRLS = jest.fn(async <T>(cb: (c: MockClient) => Promise<T>) => cb(mockClient));

  jest.unstable_mockModule(modulePath, () => ({
    pool: mockPool,
    withDb,
    withDbNoRLS,
  }));

  return { mockPool, mockClient, withDb, withDbNoRLS };
}

/* ------------------------------------------------------------------ */
/*  JWT helper                                                        */
/* ------------------------------------------------------------------ */
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-jwt-secret-for-ci';

interface TokenPayload {
  user_id?: string;
  email?: string;
  role?: string;
}

export function signTestToken(overrides: TokenPayload = {}): string {
  const payload = {
    user_id: overrides.user_id ?? 'u-test-1',
    email: overrides.email ?? 'test@example.com',
    role: overrides.role ?? 'student',
  };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h', jwtid: 'test-jti-1' });
}
