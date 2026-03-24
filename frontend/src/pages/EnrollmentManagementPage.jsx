import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, Plus, Trash2, Pencil, Loader2, AlertCircle, Search,
  UserPlus, X, Check, ChevronDown,
} from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

/**
 * Enrollment management (instructor): list, add, edit, remove. GET/POST/PATCH/DELETE /enrollments.
 * Optional GET /enrollments/course/:courseId/members for course-scoped members.
 * @returns {JSX.Element}
 */
export default function EnrollmentManagementPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Add enrollment form */
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ user_id: '', course_id: '', group_id: '', is_primary: false });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  /* Edit enrollment */
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ group_id: '', is_primary: false });
  const [editLoading, setEditLoading] = useState(false);

  /* Search/Filter */
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('');

  /* Course-scoped members (GET /enrollments/course/:courseId/members) */
  const [courseMembers, setCourseMembers] = useState(null);
  const [courseMembersLoading, setCourseMembersLoading] = useState(false);

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await API.get('/enrollments');
      setEnrollments(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  /** When a course is selected, fetch its members via GET /enrollments/course/:courseId/members */
  useEffect(() => {
    if (!filterCourse) {
      setCourseMembers(null);
      return;
    }
    setCourseMembersLoading(true);
    API.get(`/enrollments/course/${filterCourse}/members`)
      .then((res) => setCourseMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCourseMembers([]))
      .finally(() => setCourseMembersLoading(false));
  }, [filterCourse]);

  /* Unique courses for filter dropdown */
  const courses = useMemo(() => {
    const set = new Set(enrollments.map((e) => e.course_id).filter(Boolean));
    return [...set].sort();
  }, [enrollments]);

  /* List: use courseMembers when a course is selected (with search filter), otherwise filter enrollments */
  const filtered = useMemo(() => {
    const applySearch = (list) => {
      if (!search.trim()) return list;
      const q = search.toLowerCase();
      return list.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.email || '').toLowerCase().includes(q) ||
          (e.group_id || '').toLowerCase().includes(q)
      );
    };
    if (filterCourse) return applySearch(courseMembers ?? []);
    let list = enrollments;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.email || '').toLowerCase().includes(q) ||
          (e.group_id || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrollments, filterCourse, search, courseMembers]);

  /* Add enrollment */
  const handleAdd = async () => {
    if (!addForm.user_id || !addForm.course_id) {
      setAddError('User ID and Course ID are required');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      await API.post('/enrollments', addForm);
      setShowAdd(false);
      setAddForm({ user_id: '', course_id: '', group_id: '', is_primary: false });
      await loadEnrollments();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add enrollment');
    } finally {
      setAddLoading(false);
    }
  };

  /* Update enrollment */
  const handleUpdate = async (enrollmentId) => {
    setEditLoading(true);
    try {
      await API.patch(`/enrollments/${enrollmentId}`, editForm);
      setEditingId(null);
      await loadEnrollments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update enrollment');
    } finally {
      setEditLoading(false);
    }
  };

  /* Delete enrollment */
  const handleDelete = async (enrollmentId) => {
    if (!window.confirm('Remove this enrollment?')) return;
    try {
      await API.delete(`/enrollments/${enrollmentId}`);
      await loadEnrollments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove enrollment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#000E2F]" />
        <span className="ml-2 text-slate-500">Loading enrollments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#000E2F]" />
            Enrollment Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage student course registrations and group assignments
          </p>
        </div>
        <Button icon={UserPlus} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add Enrollment'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Enrollment Form */}
      {showAdd && (
        <Card className="p-6 border-teal-200 bg-teal-50/30">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add New Enrollment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">User ID *</label>
              <input
                type="text"
                placeholder="UUID of the user"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
                value={addForm.user_id}
                onChange={(e) => setAddForm({ ...addForm, user_id: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Course ID *</label>
              <input
                type="text"
                placeholder="e.g. CSE2102-2025S"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
                value={addForm.course_id}
                onChange={(e) => setAddForm({ ...addForm, course_id: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Group ID</label>
              <input
                type="text"
                placeholder="e.g. Team-43"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
                value={addForm.group_id}
                onChange={(e) => setAddForm({ ...addForm, group_id: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.is_primary}
                  onChange={(e) => setAddForm({ ...addForm, is_primary: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Primary
              </label>
              <Button size="sm" onClick={handleAdd} loading={addLoading} disabled={addLoading}>
                Add
              </Button>
            </div>
          </div>
          {addError && (
            <p className="text-sm text-red-600 mt-3 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> {addError}
            </p>
          )}
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or group..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {courses.length > 1 && (
          <div className="relative">
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 px-4 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#000E2F]/30"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
        <p className="text-sm text-slate-500 self-center">
          {filtered.length} enrollment{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Enrollments Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Course</th>
                <th className="text-left px-4 py-3 font-medium">Group</th>
                <th className="text-center px-4 py-3 font-medium">Primary</th>
                <th className="text-left px-4 py-3 font-medium">Enrolled</th>
                <th className="text-center px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {courseMembersLoading && filterCourse && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading course members...
                  </td>
                </tr>
              )}
              {!courseMembersLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No enrollments found.
                  </td>
                </tr>
              )}
              {!courseMembersLoading && filtered.map((e) => (
                <tr key={e.enrollment_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{e.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{e.email || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge type="info">{e.course_id}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === e.enrollment_id ? (
                      <input
                        type="text"
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        value={editForm.group_id}
                        onChange={(ev) => setEditForm({ ...editForm, group_id: ev.target.value })}
                      />
                    ) : (
                      <span className="text-slate-700">{e.group_id || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === e.enrollment_id ? (
                      <input
                        type="checkbox"
                        checked={editForm.is_primary}
                        onChange={(ev) => setEditForm({ ...editForm, is_primary: ev.target.checked })}
                        className="rounded border-slate-300"
                      />
                    ) : (
                      e.is_primary ? (
                        <Badge type="success">Yes</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === e.enrollment_id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(e.enrollment_id)}
                            disabled={editLoading}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                            title="Save"
                          >
                            {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(e.enrollment_id);
                              setEditForm({ group_id: e.group_id || '', is_primary: !!e.is_primary });
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(e.enrollment_id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
