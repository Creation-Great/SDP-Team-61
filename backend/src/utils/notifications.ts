import type { PoolClient } from 'pg';
import { sendNotificationEmail } from './mailer.js';
import { sendWebPushToSubscriptions } from './push.js';
import { logger } from './logger.js';

type NotificationType = 'review_received' | 'review_assigned' | 'deadline' | 'ai_complete' | 'system'
  | 'similarity_alert' | 'grade_released' | 'extension_granted' | 'reminder';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

const EMAIL_TYPES: NotificationType[] = ['review_assigned', 'deadline', 'system', 'similarity_alert', 'grade_released', 'extension_granted', 'reminder'];
const PUSH_TYPES: NotificationType[] = ['review_received', 'review_assigned', 'deadline', 'ai_complete', 'system', 'similarity_alert', 'grade_released', 'extension_granted', 'reminder'];

export async function createNotification(client: PoolClient, input: CreateNotificationInput): Promise<void> {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.userId, input.type, input.title, input.body || '', input.link || null]
  );

  try {
    const pref = await client.query(
      `SELECT email, push
       FROM notification_preferences
       WHERE user_id = $1 AND type = $2
       LIMIT 1`,
      [input.userId, input.type]
    );
    const emailEnabled = pref.rows.length > 0 ? Boolean(pref.rows[0].email) : false;
    const pushEnabled = pref.rows.length > 0 ? Boolean(pref.rows[0].push) : false;

    if (EMAIL_TYPES.includes(input.type) && emailEnabled) {
      const user = await client.query(
        `SELECT email FROM users WHERE user_id = $1 LIMIT 1`,
        [input.userId]
      );
      const to = String(user.rows[0]?.email || '').trim();
      if (to) {
        await sendNotificationEmail({
          to,
          title: input.title,
          body: input.body,
          link: input.link,
        });
      }
    }

    if (PUSH_TYPES.includes(input.type) && pushEnabled) {
      const subs = await client.query(
        `SELECT endpoint, p256dh, auth
         FROM push_subscriptions
         WHERE user_id = $1`,
        [input.userId]
      );
      if (subs.rows.length > 0) {
        const sent = await sendWebPushToSubscriptions(subs.rows as Array<{
          endpoint: string;
          p256dh: string;
          auth: string;
        }>, {
          title: input.title,
          body: input.body,
          link: input.link,
        });
        if (sent.staleEndpoints.length > 0) {
          await client.query(
            `DELETE FROM push_subscriptions
             WHERE user_id = $1 AND endpoint = ANY($2::text[])`,
            [input.userId, sent.staleEndpoints]
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err, userId: input.userId, type: input.type }, 'Notification channel delivery failed');
  }
}

export async function createNotifications(client: PoolClient, inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;

  // Batch INSERT for notification rows
  const values: unknown[] = [];
  const placeholders: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const offset = i * 5;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
    values.push(inputs[i].userId, inputs[i].type, inputs[i].title, inputs[i].body || '', inputs[i].link || null);
  }

  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ${placeholders.join(', ')}`,
    values
  );

  // Channel delivery (email/push) still runs per-notification to respect individual preferences
  for (const item of inputs) {
    try {
      const pref = await client.query(
        `SELECT email, push FROM notification_preferences WHERE user_id = $1 AND type = $2 LIMIT 1`,
        [item.userId, item.type]
      );
      const emailEnabled = pref.rows.length > 0 ? Boolean(pref.rows[0].email) : false;
      const pushEnabled = pref.rows.length > 0 ? Boolean(pref.rows[0].push) : false;

      if (EMAIL_TYPES.includes(item.type) && emailEnabled) {
        const user = await client.query(`SELECT email FROM users WHERE user_id = $1 LIMIT 1`, [item.userId]);
        const to = String(user.rows[0]?.email || '').trim();
        if (to) {
          await sendNotificationEmail({ to, title: item.title, body: item.body, link: item.link });
        }
      }

      if (PUSH_TYPES.includes(item.type) && pushEnabled) {
        const subs = await client.query(
          `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
          [item.userId]
        );
        if (subs.rows.length > 0) {
          const sent = await sendWebPushToSubscriptions(subs.rows as Array<{
            endpoint: string; p256dh: string; auth: string;
          }>, { title: item.title, body: item.body, link: item.link });
          if (sent.staleEndpoints.length > 0) {
            await client.query(
              `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = ANY($2::text[])`,
              [item.userId, sent.staleEndpoints]
            );
          }
        }
      }
    } catch (err) {
      logger.error({ err, userId: item.userId, type: item.type }, 'Batch notification channel delivery failed');
    }
  }
}
