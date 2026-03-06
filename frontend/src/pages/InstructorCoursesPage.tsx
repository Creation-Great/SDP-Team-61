import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, X, ChevronRight, Users, Calendar, Search } from 'lucide-react';
import type { CourseWithStats } from '../types';
import { apiFetch } from '../utils/api';
import { Skeleton } from '../components/Skeleton';

export default function InstructorCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTerm, setFormTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch<CourseWithStats[]>('/courses')
      .then(setCourses)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter(c => c.name.toLowerCase().includes(q));
  }, [courses, searchQuery]);

  // Aggregate stats across all courses
  const totalStudents = useMemo(() => courses.reduce((s, c) => s + (Number(c.student_count) || 0), 0), [courses]);
  const totalActiveWeeks = useMemo(() => courses.reduce((s, c) => s + (Number(c.active_week_count) || 0), 0), [courses]);
  const overallCompletionPct = useMemo(() => {
    const totalAssign = courses.reduce((s, c) => s + (Number(c.total_assignments) || 0), 0);
    const totalSubmit = courses.reduce((s, c) => s + (Number(c.submitted_assignments) || 0), 0);
    return totalAssign > 0 ? Math.round((totalSubmit / totalAssign) * 100) : 0;
  }, [courses]);

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) { setFormError('Course name is required'); return; }
    setCreating(true);
    try {
      const course = await apiFetch<CourseWithStats>('/courses', {
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
      <div className="page-hero-band">
        <div>
          <h1>Courses</h1>
          <p>Manage your peer review courses</p>
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
        <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '4px', padding: '12px 16px', color: 'var(--danger)', marginBottom: '24px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <Skeleton variant="row" height="64px" />
            <Skeleton variant="row" height="64px" />
            <Skeleton variant="row" height="64px" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            <Skeleton variant="card" height="140px" />
            <Skeleton variant="card" height="140px" />
            <Skeleton variant="card" height="140px" />
          </div>
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
            borderRadius: '4px',
          }}
        >
          <BookOpen width={40} height={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>No courses yet.</p>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem' }}>
            Create your first course to get started.
          </p>
        </motion.div>
      )}

      {/* Stats strip + search + course grid */}
      {!loading && courses.length > 0 && (
        <>
          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div className="stat-card" style={{ borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Users width={14} height={14} style={{ color: 'var(--tech-blue)' }} />
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Students
                </span>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                {totalStudents}
              </span>
            </div>
            <div className="stat-card" style={{ borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Calendar width={14} height={14} style={{ color: 'var(--uconn-orange)' }} />
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Weeks
                </span>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                {totalActiveWeeks}
              </span>
            </div>
            <div className="stat-card" style={{ borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--success)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Overall Completion
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {overallCompletionPct}%
                </span>
                <div style={{ flex: 1, height: '6px', background: 'rgba(75,159,225,0.12)', borderRadius: '4px', minWidth: '60px' }}>
                  <div style={{ height: '100%', width: `${overallCompletionPct}%`, background: overallCompletionPct >= 80 ? 'var(--success)' : overallCompletionPct >= 50 ? 'var(--uconn-orange)' : 'var(--danger)', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '360px' }}>
            <Search width={16} height={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%', paddingLeft: '36px', borderRadius: '4px' }}
            />
          </div>

          {/* Course grid */}
          {filteredCourses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
              No courses match "{searchQuery}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filteredCourses.map((course, i) => {
                const completionPct = Number(course.total_assignments) > 0
                  ? Math.round((Number(course.submitted_assignments) / Number(course.total_assignments)) * 100)
                  : 0;
                return (
                  <motion.div
                    key={course.course_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="card"
                    style={{ cursor: 'pointer', borderRadius: '4px' }}
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

                        {/* Stats row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                            <Users width={12} height={12} style={{ color: 'var(--tech-blue)' }} />
                            {Number(course.student_count) || 0} students
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                            <Calendar width={12} height={12} style={{ color: 'var(--uconn-orange)' }} />
                            {Number(course.active_week_count) || 0} active
                          </span>
                        </div>

                        {/* Completion mini bar */}
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem' }}>
                              Completion
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', fontWeight: 600 }}>
                              {completionPct}%
                            </span>
                          </div>
                          <div style={{ height: '4px', background: 'rgba(75,159,225,0.12)', borderRadius: '4px', width: '100%' }}>
                            <div style={{
                              height: '100%', width: `${completionPct}%`, borderRadius: '4px',
                              background: completionPct >= 80 ? 'var(--success)' : completionPct >= 50 ? 'var(--uconn-orange)' : 'var(--tech-blue)',
                            }} />
                          </div>
                        </div>

                        <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginTop: '8px' }}>
                          Created {new Date(course.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight width={18} height={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
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
                borderRadius: '4px',
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
                    style={{ width: '100%', borderRadius: '4px' }}
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
                    style={{ width: '100%', borderRadius: '4px' }}
                  />
                </div>

                {formError && (
                  <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '4px', padding: '10px 14px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', marginBottom: '16px' }}>
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
