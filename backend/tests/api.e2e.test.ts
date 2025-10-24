import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Ensure test env before importing app/db
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/peerreview';

import app from '../src/app';
import { pool } from '../src/db';

async function runSqlFile(relPath: string) {
  const sqlPath = path.join(__dirname, '..', relPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // Run as a single multi-statement query
  await (pool as any).query(sql);
}

beforeAll(async () => {
  // Migrate and seed fresh data
  await runSqlFile('sql/migrations.sql');
  await runSqlFile('sql/seed.sql');
});

afterAll(async () => {
  await (pool as any).end();
});

describe('Aggregates & RBAC endpoints', () => {
  test('GET /me/submissions returns assigned/completed counts for my submissions', async () => {
    const res = await request(app)
      .get('/me/submissions')
      .set('x-user-id', '00000000-0000-0000-0000-0000000000a1') // alice
      .set('x-user-role', 'student');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // From seed: alice has one submission assigned to bob, pending
    const item = res.body[0];
    expect(item).toHaveProperty('submission_id');
    expect(Number(item.assigned_count)).toBeGreaterThanOrEqual(1);
    expect(Number(item.completed_count)).toBeGreaterThanOrEqual(0);
  });

  test('GET /me/assignments returns my pending review todo list', async () => {
    const res = await request(app)
      .get('/me/assignments')
      .set('x-user-id', '00000000-0000-0000-0000-0000000000b1') // bob
      .set('x-user-role', 'student');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // From seed: bob has one pending assignment
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('assignment_id');
    expect(res.body[0]).toHaveProperty('submission_id');
  });

  test('GET /instructor/overview returns cohort-level aggregates for instructors', async () => {
    // Refresh MV to include seeded data
  await (pool as any).query('SELECT refresh_mv_instructor_cohort()');

    const res = await request(app)
      .get('/instructor/overview')
      .query({ course: 'CSE4939W', group: 'G1' })
      .set('x-user-id', '00000000-0000-0000-0000-0000000000c1') // prof
      .set('x-user-role', 'instructor');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const row = res.body[0];
    expect(row).toHaveProperty('course_id');
    expect(row).toHaveProperty('group_id');
    expect(row).toHaveProperty('wk');
    expect(Number(row.submissions)).toBeGreaterThanOrEqual(1);
    expect(Number(row.assignments)).toBeGreaterThanOrEqual(1);
    expect(Number(row.reviews_completed)).toBeGreaterThanOrEqual(0);
  });
});
