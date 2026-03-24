import webpush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:no-reply@example.com';

let configured = false;

function ensureConfigured(): boolean {
  if (!vapidPublicKey || !vapidPrivateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    configured = true;
  }
  return true;
}

export function isPushEnabled(): boolean {
  return ensureConfigured();
}

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: { title: string; body?: string; link?: string }
): Promise<{ staleEndpoints: string[] }> {
  if (!ensureConfigured()) return { staleEndpoints: [] };
  const staleEndpoints: string[] = [];
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body || '',
    link: payload.link || '/',
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        body
      );
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  return { staleEndpoints };
}
