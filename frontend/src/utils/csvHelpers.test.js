import { describe, it, expect } from 'vitest';
import {
  parseCsvLine,
  parseCsv,
  toScore,
  csvEscape,
  buildDefaultWeek,
  RESERVED_HEADERS,
} from './csvHelpers';

describe('csvHelpers', () => {
  describe('parseCsvLine', () => {
    it('splits by comma', () => {
      expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });
    it('trims cells', () => {
      expect(parseCsvLine('  a , b  , c ')).toEqual(['a', 'b', 'c']);
    });
    it('handles quoted field with comma', () => {
      expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    });
    it('handles escaped quote in quoted field', () => {
      expect(parseCsvLine('"a""b"')).toEqual(['a"b']);
    });
  });

  describe('parseCsv', () => {
    it('returns empty headers and rows for empty input', () => {
      expect(parseCsv('')).toEqual({ headers: [], rows: [] });
      expect(parseCsv('\n\n')).toEqual({ headers: [], rows: [] });
    });
    it('strips BOM', () => {
      expect(parseCsv('\uFEFFh1,h2\nv1,v2')).toEqual({
        headers: ['h1', 'h2'],
        rows: [['v1', 'v2']],
      });
    });
    it('parses header and rows', () => {
      const text = 'Team,Name,Score\nA,Alice,3\nB,Bob,4';
      expect(parseCsv(text)).toEqual({
        headers: ['Team', 'Name', 'Score'],
        rows: [
          ['A', 'Alice', '3'],
          ['B', 'Bob', '4'],
        ],
      });
    });
    it('splits on CRLF or LF', () => {
      expect(parseCsv('a,b\r\nc,d').rows).toHaveLength(1);
      expect(parseCsv('a,b\nc,d').rows).toHaveLength(1);
    });
  });

  describe('toScore', () => {
    it('returns number for 1–5', () => {
      expect(toScore(1)).toBe(1);
      expect(toScore('3')).toBe(3);
      expect(toScore(5)).toBe(5);
    });
    it('returns null for out of range or invalid', () => {
      expect(toScore(0)).toBeNull();
      expect(toScore(6)).toBeNull();
      expect(toScore('')).toBeNull();
      expect(toScore('x')).toBeNull();
      expect(toScore(NaN)).toBeNull();
    });
  });

  describe('csvEscape', () => {
    it('returns as-is when no special chars', () => {
      expect(csvEscape('hello')).toBe('hello');
      expect(csvEscape(42)).toBe('42');
    });
    it('wraps in quotes when comma, quote, or newline', () => {
      expect(csvEscape('a,b')).toBe('"a,b"');
      expect(csvEscape('a"b')).toBe('"a""b"');
      expect(csvEscape('a\nb')).toBe('"a\nb"');
    });
    it('handles null/undefined', () => {
      expect(csvEscape(null)).toBe('');
      expect(csvEscape(undefined)).toBe('');
    });
  });

  describe('buildDefaultWeek', () => {
    it('builds id, label, scores and comments for members and topics', () => {
      const members = [{ id: 'm1' }, { id: 'm2' }];
      const topics = ['t1', 't2'];
      const w = buildDefaultWeek('w1', 'Week 1', members, topics);
      expect(w.id).toBe('w1');
      expect(w.label).toBe('Week 1');
      expect(w.scores.m1).toEqual({ t1: '', t2: '' });
      expect(w.comments.m1).toBe('');
      expect(w.additional_comments).toBe('');
    });
  });

  describe('RESERVED_HEADERS', () => {
    it('contains expected reserved names', () => {
      expect(RESERVED_HEADERS.has('team')).toBe(true);
      expect(RESERVED_HEADERS.has('name')).toBe(true);
      expect(RESERVED_HEADERS.has('self')).toBe(true);
      expect(RESERVED_HEADERS.has('individual comments')).toBe(true);
    });
  });
});
