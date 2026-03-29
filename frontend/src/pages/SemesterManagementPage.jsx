import { useState, useEffect } from 'react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import { Calendar, Plus, Edit3, Copy, Check, X } from 'lucide-react';

export default function SemesterManagementPage() {
  const { showToast } = useToast();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [showForm, setShowForm] = useState(false);

  const fetchSemesters = () => {
    setLoading(true);
    API.get('/semesters')
      .then(r => setSemesters(r.data || []))
      .catch(() => showToast('Failed to load semesters', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSemesters(); }, []);

  const create = () => {
    API.post('/semesters', form)
      .then(() => { showToast('Semester created', 'success'); setShowForm(false); setForm({ name: '', start_date: '', end_date: '' }); fetchSemesters(); })
      .catch(() => showToast('Failed to create semester', 'error'));
  };

  const saveEdit = (id) => {
    API.post(`/semesters/${id}`, editData)
      .then(() => { showToast('Semester updated', 'success'); setEditId(null); fetchSemesters(); })
      .catch(() => showToast('Failed to update', 'error'));
  };

  const toggleActive = (sem) => {
    API.post(`/semesters/${sem.id}`, { is_active: !sem.is_active })
      .then(() => { showToast(`Semester ${sem.is_active ? 'deactivated' : 'activated'}`, 'success'); fetchSemesters(); })
      .catch(() => showToast('Failed to toggle status', 'error'));
  };

  const cloneCourse = (semId) => {
    API.post(`/semesters/${semId}/clone`)
      .then(() => { showToast('Course cloned', 'success'); fetchSemesters(); })
      .catch(() => showToast('Failed to clone', 'error'));
  };

  if (loading) return <div className="max-w-5xl mx-auto p-6"><div className="animate-pulse h-64 bg-slate-100 rounded-2xl" /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#000E2F] flex items-center gap-2"><Calendar size={24} /> Semester Management</h1>
        <Button onClick={() => setShowForm(!showForm)}><Plus size={16} className="mr-2" /> New Semester</Button>
      </div>

      {showForm && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Create Semester</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input placeholder="Semester name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
          </div>
          <div className="flex gap-2">
            <Button onClick={create}>Create</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {semesters.map(sem => (
          <Card key={sem.id} className="p-4">
            {editId === sem.id ? (
              <div className="flex items-center gap-3">
                <input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
                <input type="date" value={editData.start_date} onChange={e => setEditData(d => ({ ...d, start_date: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
                <input type="date" value={editData.end_date} onChange={e => setEditData(d => ({ ...d, end_date: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]" />
                <Button size="sm" onClick={() => saveEdit(sem.id)}><Check size={14} /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X size={14} /></Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{sem.name}</h3>
                  <p className="text-sm text-slate-500">{sem.start_date} - {sem.end_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge type={sem.is_active ? 'success' : 'default'}>{sem.is_active ? 'Active' : 'Inactive'}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(sem)}>{sem.is_active ? 'Deactivate' : 'Activate'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditId(sem.id); setEditData({ name: sem.name, start_date: sem.start_date, end_date: sem.end_date }); }}><Edit3 size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => cloneCourse(sem.id)}><Copy size={14} className="mr-1" /> Clone</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {semesters.length === 0 && <p className="text-center text-slate-400 py-8">No semesters found</p>}
      </div>
    </div>
  );
}
