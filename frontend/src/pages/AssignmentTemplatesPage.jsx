import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, Plus } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function AssignmentTemplatesPage() {
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/assignment-templates', {
        params: {
          course_id: courseId || undefined,
          active: activeOnly,
        },
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMsg('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  const createTemplate = async () => {
    if (!courseId.trim() || !title.trim()) {
      setMsg('Course and title are required.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await API.post('/assignment-templates', {
        course_id: courseId.trim(),
        title: title.trim(),
        description,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        is_active: true,
      });
      setTitle('');
      setDescription('');
      setDueAt('');
      await load();
      setMsg('Template created.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to create template.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    try {
      await API.patch(`/assignment-templates/${item.template_id}`, {
        is_active: !item.is_active,
      });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to update template.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-[#000E2F]" />
          Assignment Templates
        </h1>
        <p className="text-slate-500 mt-1">Create and manage reusable assignment definitions by course.</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            placeholder="Course ID (e.g. CSE2100)"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          />
          <input
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            placeholder="Template title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            type="datetime-local"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button icon={Plus} onClick={createTemplate} loading={saving}>
            Create Template
          </Button>
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Active only
          </label>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 flex items-center text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading templates...
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-slate-500">No templates found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.template_id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <Badge type={item.is_active ? 'success' : 'default'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Course: {item.course_id} · Due: {item.due_at ? new Date(item.due_at).toLocaleString() : '—'}
                  </p>
                  {item.description ? <p className="text-sm text-slate-600 mt-1">{item.description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => toggleActive(item)}>
                    {item.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {msg ? <div className="text-sm text-slate-600">{msg}</div> : null}
    </div>
  );
}
