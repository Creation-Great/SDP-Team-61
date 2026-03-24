import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';

const LABELS = {
  review_received: 'Review received',
  review_assigned: 'Review assigned',
  deadline: 'Deadline reminder',
  ai_complete: 'AI complete',
  system: 'System announcement',
};

export default function NotificationPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  const [pushReady, setPushReady] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get('/notifications/preferences')
      .then((res) => {
        if (!cancelled) setItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setMsg('Failed to load notification preferences.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function checkPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        if (mounted) {
          setPushReady(true);
          setPushSubscribed(Boolean(sub));
        }
      } catch {
        // ignore
      }
    }
    checkPush();
    return () => { mounted = false; };
  }, []);

  const updateOne = async (type, field, value) => {
    const key = `${type}:${field}`;
    setSavingKey(key);
    setMsg('');
    try {
      await API.patch('/notifications/preferences', { type, [field]: value });
      setItems((prev) => prev.map((item) => (
        item.type === type ? { ...item, [field]: value } : item
      )));
      setMsg('Preference updated.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to update preference.');
    } finally {
      setSavingKey('');
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  };

  const subscribePush = async () => {
    setPushBusy(true);
    setMsg('');
    try {
      const keyRes = await API.get('/notifications/push/public-key');
      const publicKey = keyRes.data?.publicKey;
      if (!publicKey) throw new Error('Push public key unavailable');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission denied');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await API.post('/notifications/push/subscriptions', sub.toJSON());
      setPushSubscribed(true);
      setMsg('Push subscription enabled.');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message || 'Failed to enable push.');
    } finally {
      setPushBusy(false);
    }
  };

  const unsubscribePush = async () => {
    setPushBusy(true);
    setMsg('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await API.delete('/notifications/push/subscriptions', {
          data: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      } else {
        await API.delete('/notifications/push/subscriptions');
      }
      setPushSubscribed(false);
      setMsg('Push subscription disabled.');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message || 'Failed to disable push.');
    } finally {
      setPushBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-3 text-slate-500">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BellRing className="w-6 h-6 text-[#000E2F]" />
          Notification Preferences
        </h1>
        <p className="text-slate-500 mt-1">Choose which channels you want for each notification type.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="p-3 text-left text-xs font-medium text-slate-500">Type</th>
                <th className="p-3 text-left text-xs font-medium text-slate-500">In-app</th>
                <th className="p-3 text-left text-xs font-medium text-slate-500">Email</th>
                <th className="p-3 text-left text-xs font-medium text-slate-500">Push</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.type}>
                  <td className="p-3 text-sm text-slate-700">{LABELS[item.type] || item.type}</td>
                  {['in_app', 'email', 'push'].map((field) => {
                    const key = `${item.type}:${field}`;
                    return (
                      <td key={field} className="p-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(item[field])}
                          disabled={savingKey === key}
                          onChange={(e) => updateOne(item.type, field, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Browser Push Subscription</h2>
        {!pushReady ? (
          <p className="text-sm text-slate-500">Push is not supported in this browser/environment.</p>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-[#000E2F] text-white text-sm disabled:opacity-60"
              disabled={pushBusy || pushSubscribed}
              onClick={subscribePush}
            >
              Enable Push
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm disabled:opacity-60"
              disabled={pushBusy || !pushSubscribed}
              onClick={unsubscribePush}
            >
              Disable Push
            </button>
            <span className="text-xs text-slate-500">
              Status: {pushSubscribed ? 'Subscribed' : 'Not subscribed'}
            </span>
          </div>
        )}
      </Card>

      {msg ? <div className="text-sm text-slate-600">{msg}</div> : null}
    </div>
  );
}
