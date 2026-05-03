/**
 * Unit tests for cookie helpers.
 */
import { describe, it, expect } from '@jest/globals';
import { getTokenFromCookieHeader } from '../src/utils/cookieHelper.js';

describe('getTokenFromCookieHeader', () => {
  it('should return undefined for no header', () => {
    expect(getTokenFromCookieHeader(undefined)).toBeUndefined();
    expect(getTokenFromCookieHeader('')).toBeUndefined();
  });

  it('should extract token from simple cookie header', () => {
    expect(getTokenFromCookieHeader('token=abc123')).toBe('abc123');
  });

  it('should extract token when other cookies are present', () => {
    expect(getTokenFromCookieHeader('other=x; token=jwt.value.here; foo=bar')).toBe('jwt.value.here');
  });

  it('should decode URI-encoded values', () => {
    const encoded = encodeURIComponent('a=b+c');
    expect(getTokenFromCookieHeader(`token=${encoded}`)).toBe('a=b+c');
  });

  it('should return undefined when token cookie missing', () => {
    expect(getTokenFromCookieHeader('session=abc; other=def')).toBeUndefined();
  });
});
