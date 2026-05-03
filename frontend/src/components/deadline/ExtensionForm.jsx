import { useState } from 'react';
import { Clock } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import API from '../../services/api';

export default function ExtensionForm({ onSubmit, students = [] }) {
  const [form, setForm] = useState({
    student_id: '',
    entity_type: 'assignment',
    entity_id: '',
    new_deadline: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.entity_id || !form.new_deadline) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await API.post('/deadlines/extensions', form);
      setSuccess(true);
      onSubmit?.(form);
      setForm({ student_id: '', entity_type: 'assignment', entity_id: '', new_deadline: '', reason: '' });
    } catch {
      setError('Failed to grant extension. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-[#000E2F] flex items-center gap-2 mb-4">
        <Clock size={20} />
        Grant Extension
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Student *</label>
          <select
            value={form.student_id}
            onChange={(e) => handleChange('student_id', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select student...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Entity type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
          <select
            value={form.entity_type}
            onChange={(e) => handleChange('entity_type', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="assignment">Assignment</option>
            <option value="review">Review</option>
            <option value="checkin">Check-in</option>
          </select>
        </div>

        {/* Entity ID */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Entity ID *</label>
          <input
            type="text"
            value={form.entity_id}
            onChange={(e) => handleChange('entity_id', e.target.value)}
            placeholder="Enter entity ID"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* New deadline */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Deadline *</label>
          <input
            type="datetime-local"
            value={form.new_deadline}
            onChange={(e) => handleChange('new_deadline', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <textarea
            value={form.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Reason for extension..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Extension granted successfully.</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Granting...' : 'Grant Extension'}
        </Button>
      </form>
    </Card>
  );
}
