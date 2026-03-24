import type { PoolClient } from 'pg';
import { sendNotificationEmail } from './mailer.js';
import { sendWebPushToSubscriptions } from './push.js';

type NotificationType = 'review_received' | 'review_assigned' | 'deadline' | 'ai_complete' | 'system';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

const EMAIL_TYPES: NotificationType[] = ['review_assigned', 'deadline', 'system'];
const PUSH_TYPES: NotificationType[] = ['review_received', 'review_assigned', 'deadline', 'ai_complete', 'system'];

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
  } catch {
    // Non-blocking by design: notification insertion should not fail due to channel delivery errors.
  }
}

export async function createNotifications(client: PoolClient, inputs: CreateNotificationInput[]): Promise<void> {
  for (const item of inputs) {
    await createNotification(client, item);
  }
}
