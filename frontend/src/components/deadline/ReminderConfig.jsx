import { useState } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';

const PRESET_HOURS = [1, 6, 12, 24, 48, 72];

export default function ReminderConfig({ entityType, entityId, existingReminders = [], onSave }) {
  const [reminders, setReminders] = useState(existingReminders.length > 0 ? existingReminders : [24]);
  const [saving, setSaving] = useState(false);

  const addReminder = () => {
    setReminders(prev => [...prev, 24]);
  };

  const removeReminder = (index) => {
    setReminders(prev => prev.filter((_, i) => i !== index));
  };

  const updateReminder = (index, value) => {
    setReminders(prev => prev.map((r, i) => (i === index ? Number(value) : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.({ entityType, entityId, reminderHours: reminders });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h4 className="text-sm font-semibold text-[#000E2F] flex items-center gap-2 mb-4">
        <Bell size={16} />
        Deadline Reminders
      </h4>

      <div className="space-y-3">
        {reminders.map((hours, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={hours}
              onChange={(e) => updateReminder(idx, e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRESET_HOURS.map(h => (
                <option key={h} value={h}>
                  {h >= 24 ? `${h / 24} day${h >= 48 ? 's' : ''}` : `${h} hour${h > 1 ? 's' : ''}`} before
                </option>
              ))}
            </select>
            <button
              onClick={() => removeReminder(idx)}
              disabled={reminders.length <= 1}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              aria-label="Remove reminder"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addReminder}
        className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus size={14} />
        Add reminder
      </button>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          {saving ? 'Saving...' : 'Save Reminders'}
        </Button>
      </div>
    </Card>
  );
}
