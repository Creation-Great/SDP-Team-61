import { Response } from 'express';
import { withDb } from '../db.js';
import type { AuthRequest } from '../types.js';

// ── Checkin data interfaces ────────────────────────────────
interface CheckinMember {
  id: string;
  name?: string;
  team?: string;
  mapped_user_id?: string;
}

interface InstructorWeek {
  scores?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

interface SelfWeek {
  self_score?: unknown;
  peer_scores?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

interface StudentRow {
  selected_member_id?: string;
  weeks?: SelfWeek[];
}

// ── Helper functions ───────────────────────────────────────
function toScore(value: unknown): number | null {
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

function buildComparison(topics: string[], instructorWeeks: InstructorWeek[], selectedMemberId: string, selfWeeks: SelfWeek[]) {
  return topics.map((topic: string) => {
    let selfSum = 0;
    let selfCount = 0;
    let profSum = 0;
    let profCount = 0;

    (selfWeeks || []).forEach((week) => {
      const score = toScore(week?.peer_scores?.[selectedMemberId]?.[topic]);
      if (score !== null) {
        selfSum += score;
        selfCount += 1;
      }
    });

    (instructorWeeks || []).forEach((week) => {
      const score = toScore(week?.scores?.[selectedMemberId]?.[topic]);
      if (score !== null) {
        profSum += score;
        profCount += 1;
      }
    });

    const selfAverage = selfCount > 0 ? Number((selfSum / selfCount).toFixed(2)) : null;
    const instructorAverage = profCount > 0 ? Number((profSum / profCount).toFixed(2)) : null;
    const delta =
      selfAverage !== null && instructorAverage !== null
        ? Number((selfAverage - instructorAverage).toFixed(2))
        : null;

    return { topic, self_average: selfAverage, instructor_average: instructorAverage, delta };
  });
}

function findMappedMemberId(members: CheckinMember[], userId: string): string | null {
  if (!Array.isArray(members)) return null;
  const found = members.find((m) => m?.mapped_user_id === userId);
  return found?.id || null;
}

function buildInstructorAggregates(members: CheckinMember[], topics: string[], instructorWeeks: InstructorWeek[], studentRows: StudentRow[]) {
  const instr = new Map<string, { sum: number; count: number }>();
  const self = new Map<string, { sum: number; count: number }>();
  const peer = new Map<string, { sum: number; count: number }>();

  (members || []).forEach((m) => {
    instr.set(m.id, { sum: 0, count: 0 });
    self.set(m.id, { sum: 0, count: 0 });
    peer.set(m.id, { sum: 0, count: 0 });
  });

  (instructorWeeks || []).forEach((week) => {
    (members || []).forEach((m) => {
      (topics || []).forEach((topic: string) => {
        const score = toScore(week?.scores?.[m.id]?.[topic]);
        if (score === null) return;
        const bucket = instr.get(m.id);
        if (!bucket) return;
        bucket.sum += score;
        bucket.count += 1;
      });
    });
  });

  (studentRows || []).forEach((row) => {
    const target = row.selected_member_id;
    if (!target) return;
    (row.weeks || []).forEach((week) => {
      const selfScore = toScore(week?.self_score);
      if (selfScore !== null) {
        const selfBucket = self.get(target);
        if (selfBucket) {
          selfBucket.sum += selfScore;
          selfBucket.count += 1;
        }
      }

      Object.entries(week?.peer_scores || {}).forEach(([targetMemberId, topicMap]) => {
        Object.values(topicMap || {}).forEach((raw: unknown) => {
          const s = toScore(raw);
          if (s === null) return;
          const peerBucket = peer.get(targetMemberId);
          if (!peerBucket) return;
          peerBucket.sum += s;
          peerBucket.count += 1;
        });
      });
    });
  });

  return (members || []).map((m) => {
    const instrBucket = instr.get(m.id) || { sum: 0, count: 0 };
    const selfBucket = self.get(m.id) || { sum: 0, count: 0 };
    const peerBucket = peer.get(m.id) || { sum: 0, count: 0 };
    return {
      member_id: m.id,
      team: m.team || '',
      name: m.name || '',
      self_average: selfBucket.count > 0 ? Number((selfBucket.sum / selfBucket.count).toFixed(2)) : null,
      peer_average: peerBucket.count > 0 ? Number((peerBucket.sum / peerBucket.count).toFixed(2)) : null,
      instructor_average:
        instrBucket.count > 0 ? Number((instrBucket.sum / instrBucket.count).toFixed(2)) : null,
    };
  });
}

/**
 * GET /checkins/context
 * Student loads instructor check-in structure + current self ratings + comparison.
 */
export async function getStudentCheckinContext(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;

  const payload = await withDb(user_id, role, async (client) => {

    const instructorData = await client.query(
        `SELECT checkin_id, file_name, topics, members, weeks, updated_at
         FROM student_checkins
         WHERE course_id = $1 AND group_id = $2
         ORDER BY updated_at DESC
         LIMIT 1`,
        [course_id || '', group_id || '']
      );

      const selfData = await client.query(
        `SELECT selected_member_id, weeks, updated_at
         FROM student_self_checkins
         WHERE student_id = $1 AND course_id = $2 AND group_id = $3`,
        [user_id, course_id || '', group_id || '']
      );

      const instructor = instructorData.rows[0] || null;
      const self = selfData.rows[0] || null;

      const topics = Array.isArray(instructor?.topics) ? instructor.topics : [];
      const instructorWeeks = Array.isArray(instructor?.weeks) ? instructor.weeks : [];
      const selfWeeks = Array.isArray(self?.weeks) ? self.weeks : [];
      const mappedMemberId = findMappedMemberId(
        Array.isArray(instructor?.members) ? instructor.members : [],
        user_id
      );
      const selectedMemberId = self?.selected_member_id || mappedMemberId || null;

      const comparison =
        selectedMemberId && topics.length > 0
          ? buildComparison(topics, instructorWeeks, selectedMemberId, selfWeeks)
          : [];

      return {
        instructor: instructor
          ? {
              checkin_id: instructor.checkin_id,
              file_name: instructor.file_name,
              topics,
              members: Array.isArray(instructor.members) ? instructor.members : [],
              weeks: instructorWeeks,
              updated_at: instructor.updated_at,
            }
          : null,
        self: {
          selected_member_id: selectedMemberId,
          weeks: selfWeeks,
          updated_at: self?.updated_at || null,
        },
        comparison,
      };
    });

    res.json(payload);
}

/**
 * POST /checkins/self
 * Save student self-ratings and return updated comparison with instructor ratings.
 */
export async function saveStudentSelfCheckins(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;
  const { selected_member_id, weeks } = req.body;

  const payload = await withDb(user_id, role, async (client) => {

      await client.query(
        `INSERT INTO student_self_checkins (student_id, course_id, group_id, selected_member_id, weeks, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())
         ON CONFLICT (student_id, course_id, group_id)
         DO UPDATE SET
           selected_member_id = EXCLUDED.selected_member_id,
           weeks = EXCLUDED.weeks,
           updated_at = now()`,
        [user_id, course_id || '', group_id || '', selected_member_id, JSON.stringify(weeks)]
      );

      const instructorData = await client.query(
        `SELECT topics, weeks
         FROM student_checkins
         WHERE course_id = $1 AND group_id = $2
         ORDER BY updated_at DESC
         LIMIT 1`,
        [course_id || '', group_id || '']
      );

      const topics = Array.isArray(instructorData.rows[0]?.topics) ? instructorData.rows[0].topics : [];
      const instructorWeeks = Array.isArray(instructorData.rows[0]?.weeks) ? instructorData.rows[0].weeks : [];
      const comparison = buildComparison(topics, instructorWeeks, selected_member_id, weeks);

      return { comparison };
    });

    res.json({ message: 'Self check-ins saved', ...payload });
}

/**
 * GET /instructor/checkins/insights
 * Instructor-only aggregated comparison (instructor vs student self vs peer).
 */
export async function getInstructorCheckinInsights(req: AuthRequest, res: Response): Promise<void> {
  const { user_id, role, course_id, group_id } = req.user;

  const payload = await withDb(user_id, role, async (client) => {

      const instructorData = await client.query(
        `SELECT topics, members, weeks
         FROM student_checkins
         WHERE instructor_id = $1
           AND course_id = $2
           AND group_id = $3
         ORDER BY updated_at DESC
         LIMIT 1`,
        [user_id, course_id || '', group_id || '']
      );

      const instructor = instructorData.rows[0] || null;
      if (!instructor) {
        return { insights: [], student_submissions: 0 };
      }

      const studentRowsResult = await client.query(
        `SELECT selected_member_id, weeks
         FROM student_self_checkins
         WHERE course_id = $1
           AND group_id = $2`,
        [course_id || '', group_id || '']
      );

      const topics = Array.isArray(instructor.topics) ? instructor.topics : [];
      const members = Array.isArray(instructor.members) ? instructor.members : [];
      const instructorWeeks = Array.isArray(instructor.weeks) ? instructor.weeks : [];
      const studentRows = studentRowsResult.rows || [];
      const handedOut = studentRows
        .filter((r: StudentRow) => r.selected_member_id)
        .map((r: StudentRow) => ({
          rater_member_id: r.selected_member_id,
          weeks: Array.isArray(r.weeks) ? r.weeks : [],
        }));

      return {
        insights: buildInstructorAggregates(members, topics, instructorWeeks, studentRows),
        student_submissions: studentRows.length,
        handed_out: handedOut,
      };
    });

    res.json(payload);
}
