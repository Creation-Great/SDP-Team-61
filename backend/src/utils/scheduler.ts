/**
 * Periodic deadline reminder scheduler.
 *
 * Runs every REMINDER_CHECK_INTERVAL_MS (default 15 min), queries the
 * deadline_reminders table for unsent reminders whose trigger time has passed,
 * then creates notifications for affected users.
 */
import { pool } from '../db.js';
import { logger } from './logger.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function checkReminders(): Promise<void> {
  try {
    // Find sessions/templates with deadlines approaching and unsent reminders
    const { rows: reminders } = await pool.query(`
      SELECT dr.id, dr.entity_type, dr.entity_id, dr.reminder_hours
      FROM deadline_reminders dr
      WHERE dr.sent_at IS NULL
        AND EXISTS (
          SELECT 1 FROM peer_review_sessions prs
          WHERE prs.session_id = dr.entity_id
            AND dr.entity_type = 'session'
            AND prs.deadline IS NOT NULL
            AND prs.deadline - (dr.reminder_hours || ' hours')::interval <= now()
            AND prs.deadline > now()
            AND prs.is_open = true
        )
      LIMIT 50
    `);

    for (const r of reminders) {
      try {
        // Get users who haven't submitted for this session
        const { rows: users } = await pool.query(`
          SELECT DISTINCT ue.user_id
          FROM user_enrollments ue
          JOIN peer_review_sessions prs ON prs.session_id = $1
          WHERE ue.course_id = prs.course_id
            AND ue.role = 'student'
            AND NOT EXISTS (
              SELECT 1 FROM peer_reviews pr
              WHERE pr.session_id = $1 AND pr.reviewer_id = ue.user_id
            )
        `, [r.entity_id]);

        // Create notifications (using pool directly since we're outside a request context)
        for (const u of users) {
          await pool.query(`
            INSERT INTO notifications (user_id, type, title, body, link, is_read)
            VALUES ($1, 'reminder', 'Deadline Approaching',
                    $2, $3, false)
            ON CONFLICT DO NOTHING
          `, [
            u.user_id,
            `Peer review deadline is in ${r.reminder_hours} hours`,
            `/peer-review/${r.entity_id}`,
          ]);
        }

        // Mark reminder as sent
        await pool.query(
          'UPDATE deadline_reminders SET sent_at = now() WHERE id = $1',
          [r.id]
        );

        logger.info({ reminderId: r.id, usersNotified: users.length }, 'Deadline reminder sent');
      } catch (err) {
        logger.warn({ err, reminderId: r.id }, 'Failed to process reminder');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Reminder scheduler check failed');
  }
}

export function startReminderScheduler(): () => void {
  const intervalMs = parseInt(process.env.REMINDER_CHECK_INTERVAL_MS || '900000', 10);
  logger.info({ intervalMs }, 'Starting deadline reminder scheduler');

  // Initial check after 30s delay
  setTimeout(() => checkReminders(), 30_000);

  intervalHandle = setInterval(checkReminders, intervalMs);
  intervalHandle.unref();

  return () => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
}
