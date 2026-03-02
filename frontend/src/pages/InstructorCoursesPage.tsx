import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, X, ChevronRight } from 'lucide-react';
import type { Course } from '../types';

function getToken() {
  return localStorage.getItem('token') || '';
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function InstructorCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTerm, setFormTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<Course[]>('/courses')
      .then(setCourses)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) { setFormError('Course name is required'); return; }
    setCreating(true);
    try {
      const course = await apiFetch<Course>('/courses', {
        method: 'POST',
        body: JSON.stringify({ name: formName.trim(), term: formTerm.trim() || null }),
      });
      setCourses(prev => [course, ...prev]);
      setShowModal(false);
      setFormName('');
      setFormTerm('');
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '6px' }}>
            Courses
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            Manage your peer review courses
          </p>
        </div>
        <button
          type="button"
          className="btn btn-cta"
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus width={16} height={16} />
          New Course
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--danger)', marginBottom: '24px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', textAlign: 'center', padding: '48px 0' }}>
          Loading courses...
        </div>
      )}

      {/* Empty state */}
      {!loading && courses.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            textAlign: 'center', padding: '64px 24px',
            background: 'var(--surface-card)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--border-radius)',
          }}
        >
          <BookOpen width={40} height={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>No courses yet.</p>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            Create your first course to get started.
          </p>
        </motion.div>
      )}

      {/* Course grid */}
      {!loading && courses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {courses.map((course, i) => (
            <motion.div
              key={course.course_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/instructor/courses/${course.course_id}`)}
              onKeyDown={e => e.key === 'Enter' && navigate(`/instructor/courses/${course.course_id}`)}
              tabIndex={0}
              role="button"
              aria-label={`Open course ${course.name}`}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <BookOpen width={16} height={16} style={{ color: 'var(--tech-blue)', flexShrink: 0 }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {course.name}
                    </h3>
                  </div>
                  {course.term && (
                    <span style={{ display: 'inline-block', background: 'rgba(75,159,225,0.1)', color: 'var(--tech-blue)', border: '1px solid rgba(75,159,225,0.2)', borderRadius: '4px', padding: '2px 8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fontWeight: 600 }}>
                      {course.term}
                    </span>
                  )}
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginTop: '8px' }}>
                    Created {new Date(course.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight width={18} height={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Course Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,7,24,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px',
            }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              key="modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--border-radius)',
                padding: '32px',
                width: '100%',
                maxWidth: '440px',
                boxShadow: 'var(--glass-shadow-float)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                  New Course
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <X width={20} height={20} />
                </button>
              </div>

              <form onSubmit={handleCreateCourse}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Course Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSE 4939W Software Design"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                    className="form-input"
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Term (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spring 2026"
                    value={formTerm}
                    onChange={e => setFormTerm(e.target.value)}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                {formError && (
                  <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '6px', padding: '10px 14px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setShowModal(false); setFormError(null); }}
                    style={{ padding: '10px 20px' }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-cta" disabled={creating} style={{ padding: '10px 24px' }}>
                    {creating ? 'Creating...' : 'Create Course'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
