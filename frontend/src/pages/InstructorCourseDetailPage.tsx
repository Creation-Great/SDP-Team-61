import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Plus, ChevronRight, Users, Calendar, CheckCircle,
  Clock, ArrowLeft, ChevronDown, ChevronUp, History, X,
} from 'lucide-react';
import type { Course, CourseDefinitionCurrent, Week, CsvDiffPreview } from '../types';
import { apiFetch, apiFetchRaw } from '../utils/api';
import { useToast } from '../components/ToastProvider';

interface DefinitionSummary {
  definition_id: string;
  uploaded_at: string;
  uploaded_by_name: string;
  team_count: number;
  student_count: number;
  category_count: number;
}

// Steps for the "Add Week" dialog
type WeekDialogStep = 1 | 2 | 3 | 4;

interface WeekDialogState {
  scopeType: 'ALL' | 'TEAM';
  selectedTeamKeys: string[];
  weekMode: 'new' | 'existing';
  existingWeekId: string;
  customClosesAt: string;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InstructorCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [definition, setDefinition] = useState<CourseDefinitionCurrent | null>(null);
  const [definitionHistory, setDefinitionHistory] = useState<DefinitionSummary[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 3b: CSV diff preview state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [diffPreview, setDiffPreview] = useState<CsvDiffPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [allTeamsExpanded, setAllTeamsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Week creation dialog state
  const [showWeekDialog, setShowWeekDialog] = useState(false);
  const [weekDialogStep, setWeekDialogStep] = useState<WeekDialogStep>(1);
  const [weekDialog, setWeekDialog] = useState<WeekDialogState>({
    scopeType: 'ALL',
    selectedTeamKeys: [],
    weekMode: 'new',
    existingWeekId: '',
    customClosesAt: '',
  });
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);

  function loadData() {
    if (!courseId) return Promise.resolve();
    return Promise.all([
      apiFetch<Course & { weeks: Week[] }>(`/courses/${courseId}`),
      apiFetch<CourseDefinitionCurrent>(`/courses/${courseId}/definition/current`).catch(() => null),
      apiFetch<DefinitionSummary[]>(`/courses/${courseId}/definitions`).catch(() => [] as DefinitionSummary[]),
    ]).then(([courseData, defData, historyData]) => {
      setCourse({ course_id: courseData.course_id, name: courseData.name, term: courseData.term, created_at: courseData.created_at });
      setWeeks(courseData.weeks || []);
      setDefinition(defData);
      setDefinitionHistory(historyData);
    });
  }

  useEffect(() => {
    setLoading(true);
    loadData().catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [courseId]);

  // Phase 3b: Preview CSV diff when file is selected
  async function handleFileSelected(file: File) {
    setUploadError(null);
    setPreviewError(null);
    setPendingFile(file);
    setPreviewing(true);
    setDiffPreview(null);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetchRaw(`/courses/${courseId}/definition/preview`, {
        method: 'POST',
        body: form,
      });
      const preview: CsvDiffPreview = await res.json();
      setDiffPreview(preview);
    } catch (e: any) {
      setPreviewError(e.message);
      setPendingFile(null);
    } finally {
      setPreviewing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Phase 3b: Confirm upload with the pending file
  async function handleConfirmUpload() {
    if (!pendingFile) return;
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      await apiFetchRaw(`/courses/${courseId}/definition/upload`, {
        method: 'POST',
        body: form,
      });
      const [defData, historyData] = await Promise.all([
        apiFetch<CourseDefinitionCurrent>(`/courses/${courseId}/definition/current`).catch(() => null),
        apiFetch<DefinitionSummary[]>(`/courses/${courseId}/definitions`).catch(() => [] as DefinitionSummary[]),
      ]);
      setDefinition(defData);
      setDefinitionHistory(historyData);
      addToast({ type: 'success', title: 'Roster uploaded', message: 'CSV definition has been updated.' });
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
      setPendingFile(null);
      setDiffPreview(null);
    }
  }

  // Phase 3b: Cancel diff preview
  function handleCancelPreview() {
    setPendingFile(null);
    setDiffPreview(null);
    setPreviewError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openWeekDialog() {
    setWeekDialog({
      scopeType: 'ALL',
      selectedTeamKeys: [],
      weekMode: 'new',
      existingWeekId: '',
      customClosesAt: '',
    });
    setWeekDialogStep(1);
    setWeekError(null);
    setShowWeekDialog(true);
  }

  function closeWeekDialog() {
    setShowWeekDialog(false);
    setWeekError(null);
  }

  function dialogNext() {
    setWeekError(null);
    if (weekDialogStep === 1) {
      if (weekDialog.scopeType === 'ALL') {
        setWeekDialogStep(3);
      } else {
        setWeekDialogStep(2);
      }
    } else if (weekDialogStep === 2) {
      if (weekDialog.selectedTeamKeys.length === 0) {
        setWeekError('Select at least one team');
        return;
      }
      setWeekDialogStep(3);
    } else if (weekDialogStep === 3) {
      if (weekDialog.weekMode === 'existing' && !weekDialog.existingWeekId) {
        setWeekError('Select an existing open week');
        return;
      }
      setWeekDialogStep(4);
    }
  }

  function dialogBack() {
    setWeekError(null);
    if (weekDialogStep === 4) {
      setWeekDialogStep(3);
    } else if (weekDialogStep === 3) {
      if (weekDialog.scopeType === 'ALL') {
        setWeekDialogStep(1);
      } else {
        setWeekDialogStep(2);
      }
    } else if (weekDialogStep === 2) {
      setWeekDialogStep(1);
    }
  }

  function toggleTeamKey(key: string) {
    setWeekDialog(prev => ({
      ...prev,
      selectedTeamKeys: prev.selectedTeamKeys.includes(key)
        ? prev.selectedTeamKeys.filter(k => k !== key)
        : [...prev.selectedTeamKeys, key],
    }));
  }

  async function handleCreateWeek() {
    setWeekError(null);
    setCreatingWeek(true);
    try {
      const body: any = { scopeType: weekDialog.scopeType };

      if (weekDialog.scopeType === 'TEAM') {
        body.teamKeys = weekDialog.selectedTeamKeys;
      }

      if (weekDialog.weekMode === 'existing' && weekDialog.existingWeekId) {
        body.existingWeekId = weekDialog.existingWeekId;
      }

      if (weekDialog.customClosesAt) {
        body.closesAt = weekDialog.customClosesAt;
      }

      const week = await apiFetch<Week>(`/courses/${courseId}/weeks`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (weekDialog.weekMode === 'existing') {
        setWeeks(prev => prev.map(w => w.week_id === week.week_id ? week : w));
      } else {
        setWeeks(prev => [week, ...prev]);
      }

      closeWeekDialog();
    } catch (e: any) {
      setWeekError(e.message);
    } finally {
      setCreatingWeek(false);
    }
  }

  function toggleTeam(key: string) {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Phase 3b: Expand All / Collapse All
  function handleToggleAllTeams() {
    if (allTeamsExpanded) {
      setExpandedTeams(new Set());
      setAllTeamsExpanded(false);
    } else {
      const allKeys = new Set(definition?.teams.map(t => t.teamKey) || []);
      setExpandedTeams(allKeys);
      setAllTeamsExpanded(true);
    }
  }

  // Open weeks available for "Add to existing week"
  const openWeeks = weeks.filter(w => w.is_open);

  const teamKeys = definition ? definition.teams.map(t => t.teamKey) : [];
  const totalStudents = definition
    ? definition.teams.reduce((s, t) => s + t.members.length, 0)
    : 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem' }}>
        Loading...
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <p style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error || 'Course not found'}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/instructor/courses')}>Back to Courses</button>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/instructor/courses"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--tech-blue)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft width={14} height={14} />
          Courses
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '6px' }}>
          {course.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {course.term && (
            <span style={{ display: 'inline-block', background: 'rgba(75,159,225,0.1)', color: 'var(--tech-blue)', border: '1px solid rgba(75,159,225,0.2)', borderRadius: '0', padding: '2px 8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', fontWeight: 600 }}>
              {course.term}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
            Created {new Date(course.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Course Overview */}
      {(
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Roster / Definition Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users width={18} height={18} style={{ color: 'var(--tech-blue)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Course Roster</h2>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || previewing}
                style={{ fontSize: '0.75rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Upload width={13} height={13} />
                {previewing ? 'Previewing...' : uploading ? 'Uploading...' : 'Upload CSV'}
              </button>
            </div>
          </div>

          {uploadError && (
            <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '0', padding: '10px 14px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', marginBottom: '16px' }}>
              {uploadError}
            </div>
          )}

          {previewError && (
            <div style={{ background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '0', padding: '10px 14px', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', marginBottom: '16px' }}>
              Preview failed: {previewError}
            </div>
          )}

          {/* Phase 3b: CSV Diff Preview Card */}
          {diffPreview && (
            <div style={{
              border: '1px solid rgba(75,159,225,0.25)',
              borderRadius: '0',
              padding: '16px',
              marginBottom: '16px',
              background: 'rgba(75,159,225,0.03)',
            }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', fontFamily: 'Montserrat, sans-serif' }}>
                Upload Preview
              </h3>

              {/* Added */}
              {diffPreview.added.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <p style={{ color: 'var(--success)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    + Added
                  </p>
                  {diffPreview.added.map(item => (
                    <div key={item.team_key} style={{
                      padding: '8px 12px', marginBottom: '4px',
                      background: 'rgba(61,187,121,0.08)', border: '1px solid rgba(61,187,121,0.2)', borderRadius: '0',
                    }}>
                      <span style={{ color: 'var(--success)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                        Team {item.team_key}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {item.students.map(s => (
                          <span key={s} style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Removed */}
              {diffPreview.removed.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <p style={{ color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    - Removed
                  </p>
                  {diffPreview.removed.map(item => (
                    <div key={item.team_key} style={{
                      padding: '8px 12px', marginBottom: '4px',
                      background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.2)', borderRadius: '0',
                    }}>
                      <span style={{ color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                        Team {item.team_key}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {item.students.map(s => (
                          <span key={s} style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unchanged */}
              {diffPreview.unchanged.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Unchanged
                  </p>
                  {diffPreview.unchanged.map(item => (
                    <div key={item.team_key} style={{
                      padding: '6px 12px', marginBottom: '4px',
                      background: 'rgba(100,100,120,0.06)', border: '1px solid rgba(100,100,120,0.12)', borderRadius: '0',
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                        Team {item.team_key} — {item.count} student{item.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* No changes */}
              {diffPreview.added.length === 0 && diffPreview.removed.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', marginBottom: '12px' }}>
                  No changes detected. The roster is identical to the current definition.
                </p>
              )}

              {/* Confirm / Cancel buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCancelPreview}
                  disabled={uploading}
                  style={{ fontSize: '0.75rem', padding: '7px 14px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  style={{ fontSize: '0.75rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Upload width={13} height={13} />
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </div>
          )}

          {!definition ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', marginBottom: '8px', lineHeight: '1.7' }}>
                No roster uploaded yet.
              </p>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', lineHeight: '1.7' }}>
                Upload a CSV with columns: <strong>Team, Name</strong> plus any review categories (e.g. Technical, Teamwork).
              </p>
            </div>
          ) : (
            <div>
              {/* Summary strip */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '10px 14px', background: 'var(--surface-input)', borderRadius: '0', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                  <strong style={{ color: 'var(--tech-blue)' }}>{definition.teams.length}</strong> teams
                </span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                  <strong style={{ color: 'var(--tech-blue)' }}>{totalStudents}</strong> students
                </span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                  <strong style={{ color: 'var(--uconn-orange)' }}>{definition.categories.length}</strong> categories
                </span>
                {definition.uploadedAt && (
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', marginLeft: 'auto' }}>
                    {new Date(definition.uploadedAt).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Categories */}
              <div style={{ marginBottom: '14px' }}>
                <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Review Categories
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {definition.categories.map(c => (
                    <span key={c} style={{ background: 'rgba(232,119,34,0.08)', color: 'var(--uconn-orange)', border: '1px solid rgba(232,119,34,0.15)', borderRadius: '0', padding: '3px 8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Teams expandable */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Teams &amp; Students
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleAllTeams}
                    style={{
                      background: 'none', border: '1px solid var(--glass-border)', cursor: 'pointer',
                      color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem',
                      padding: '3px 10px', borderRadius: '0',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--tech-blue)'; e.currentTarget.style.color = 'var(--tech-blue)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    {allTeamsExpanded ? 'Collapse All' : 'Expand All'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {definition.teams.map(team => (
                    <div key={team.teamKey} style={{ border: '1px solid var(--glass-border)', borderRadius: '0', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => toggleTeam(team.teamKey)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', background: 'var(--surface-input)',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', fontWeight: 600 }}>
                          <span style={{ color: 'var(--tech-blue)' }}>Team {team.teamKey}</span>
                          <span style={{
                            background: 'rgba(75,159,225,0.1)', color: 'var(--tech-blue)',
                            border: '1px solid rgba(75,159,225,0.2)', borderRadius: '0',
                            padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700,
                          }}>
                            {team.members.length}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>members</span>
                        </span>
                        {expandedTeams.has(team.teamKey)
                          ? <ChevronUp width={14} height={14} style={{ color: 'var(--text-muted)' }} />
                          : <ChevronDown width={14} height={14} style={{ color: 'var(--text-muted)' }} />
                        }
                      </button>
                      <AnimatePresence>
                        {expandedTeams.has(team.teamKey) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: '6px 12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {team.members.map(m => (
                                <div key={m.netidGuess} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(75,159,225,0.04)' }}>
                                  <span style={{ color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                                    {m.fullName}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem' }}>
                                      {m.netidGuess}***
                                    </span>
                                    {m.userId && (
                                      <span style={{ background: 'rgba(61,187,121,0.1)', color: 'var(--success)', border: '1px solid rgba(61,187,121,0.2)', borderRadius: '0', padding: '1px 5px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem' }}>
                                        linked
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upload History */}
          {definitionHistory.length > 0 && (
            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '14px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowHistory(h => !h)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', padding: 0 }}
              >
                <History width={12} height={12} />
                Upload history ({definitionHistory.length})
                {showHistory ? <ChevronUp width={12} height={12} /> : <ChevronDown width={12} height={12} />}
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                      {definitionHistory.map((h, i) => (
                        <div key={h.definition_id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                          background: 'var(--surface-input)', borderRadius: '0',
                          border: `1px solid ${i === 0 ? 'rgba(75,159,225,0.3)' : 'var(--glass-border)'}`,
                        }}>
                          {i === 0 && (
                            <span style={{ background: 'rgba(75,159,225,0.12)', color: 'var(--tech-blue)', padding: '1px 6px', borderRadius: '0', fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', fontWeight: 600, flexShrink: 0 }}>
                              LATEST
                            </span>
                          )}
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', flex: 1 }}>
                            {new Date(h.uploaded_at).toLocaleString()} &nbsp;&middot;&nbsp;
                            {h.team_count}T / {h.student_count}S / {h.category_count}C
                          </span>
                        </div>
                      ))}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', marginTop: '8px', lineHeight: '1.5' }}>
                      Each upload is per-team. Re-uploading a team updates only that team; other teams are unchanged.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Weeks Panel */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar width={18} height={18} style={{ color: 'var(--tech-blue)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Weeks</h2>
            </div>
            <button
              type="button"
              className="btn btn-cta"
              onClick={openWeekDialog}
              disabled={!definition}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', padding: '7px 14px' }}
              title={!definition ? 'Upload a roster CSV first' : ''}
            >
              <Plus width={13} height={13} />
              Add Week
            </button>
          </div>

          {!definition && (
            <div style={{ padding: '10px 14px', background: 'rgba(232,119,34,0.06)', border: '1px solid rgba(232,119,34,0.15)', borderRadius: '0', marginBottom: '16px' }}>
              <p style={{ color: 'var(--uconn-orange)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', margin: 0 }}>
                Upload a roster CSV first to enable week creation.
              </p>
            </div>
          )}

          {/* Weeks list */}
          {weeks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
              No weeks created yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {weeks.map(week => (
                <motion.div
                  key={week.week_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'var(--surface-input)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '0',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onClick={() => navigate(`/instructor/courses/${courseId}/weeks/${week.week_id}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--glass-border-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--glass-border)'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                        Week {week.week_number}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '0',
                        fontSize: '0.68rem', fontFamily: 'Roboto Mono, monospace', fontWeight: 600,
                        background: week.is_open ? 'rgba(61,187,121,0.12)' : 'rgba(100,100,120,0.12)',
                        color: week.is_open ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${week.is_open ? 'rgba(61,187,121,0.25)' : 'rgba(100,100,120,0.2)'}`,
                      }}>
                        {week.is_open ? <CheckCircle width={10} height={10} /> : <Clock width={10} height={10} />}
                        {week.is_open ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', margin: '0 0 4px 0' }}>
                      Due {new Date(week.closes_at).toLocaleDateString()}
                      {week.scope_type === 'ALL' ? ' · All Teams' : ''}
                    </p>
                    {/* Team badges */}
                    {week.scope_type === 'TEAM' && week.team_keys && week.team_keys.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {week.team_keys.map(tk => (
                          <span key={tk} style={{
                            background: 'rgba(75,159,225,0.08)', color: 'var(--tech-blue)',
                            border: '1px solid rgba(75,159,225,0.15)', borderRadius: '0',
                            padding: '1px 6px', fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fontWeight: 600,
                          }}>
                            {tk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight width={16} height={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Add Week Dialog */}
      <AnimatePresence>
        {showWeekDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '24px',
            }}
            onClick={e => { if (e.target === e.currentTarget) closeWeekDialog(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'var(--surface-card)', borderRadius: '0',
                border: '1px solid var(--glass-border)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
                padding: '28px', width: '100%', maxWidth: '480px',
              }}
            >
              {/* Dialog header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Add Week
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 400, marginLeft: '10px' }}>
                    Step {weekDialogStep} of 4
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={closeWeekDialog}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}
                >
                  <X width={18} height={18} />
                </button>
              </div>

              {/* Step 1: Scope */}
              {weekDialogStep === 1 && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    Choose Scope
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { value: 'ALL' as const, label: 'All Teams', desc: 'Every student reviews all teammates within their team.' },
                      { value: 'TEAM' as const, label: 'Specific Teams', desc: 'Only selected teams participate in this review week.' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setWeekDialog(prev => ({ ...prev, scopeType: opt.value, selectedTeamKeys: [] }))}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          padding: '14px 16px', borderRadius: '0', cursor: 'pointer', textAlign: 'left',
                          border: `2px solid ${weekDialog.scopeType === opt.value ? 'var(--tech-blue)' : 'var(--glass-border)'}`,
                          background: weekDialog.scopeType === opt.value ? 'rgba(75,159,225,0.06)' : 'var(--surface-input)',
                          transition: 'border-color 0.1s ease',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                          {opt.label}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }}>
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Select Teams (only if TEAM scope) */}
              {weekDialogStep === 2 && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    Select Teams
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                    {teamKeys.map(tk => (
                      <label
                        key={tk}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 14px', borderRadius: '0', cursor: 'pointer',
                          border: `1px solid ${weekDialog.selectedTeamKeys.includes(tk) ? 'rgba(75,159,225,0.4)' : 'var(--glass-border)'}`,
                          background: weekDialog.selectedTeamKeys.includes(tk) ? 'rgba(75,159,225,0.06)' : 'var(--surface-input)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={weekDialog.selectedTeamKeys.includes(tk)}
                          onChange={() => toggleTeamKey(tk)}
                          style={{ accentColor: 'var(--tech-blue)', width: '15px', height: '15px' }}
                        />
                        <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Team {tk}
                        </span>
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }}>
                          {definition?.teams.find(t => t.teamKey === tk)?.members.length ?? 0} members
                        </span>
                      </label>
                    ))}
                  </div>
                  {weekDialog.selectedTeamKeys.length > 0 && (
                    <p style={{ color: 'var(--tech-blue)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', marginTop: '10px' }}>
                      {weekDialog.selectedTeamKeys.length} team{weekDialog.selectedTeamKeys.length > 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}

              {/* Step 3: New Cycle or Add to Existing Week */}
              {weekDialogStep === 3 && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    Week Cycle
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setWeekDialog(prev => ({ ...prev, weekMode: 'new' }))}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        padding: '14px 16px', borderRadius: '0', cursor: 'pointer', textAlign: 'left',
                        border: `2px solid ${weekDialog.weekMode === 'new' ? 'var(--tech-blue)' : 'var(--glass-border)'}`,
                        background: weekDialog.weekMode === 'new' ? 'rgba(75,159,225,0.06)' : 'var(--surface-input)',
                        transition: 'border-color 0.1s ease',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                        New Cycle
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }}>
                        Creates a fresh week with a new 7-day deadline starting from today.
                      </span>
                    </button>

                    {weekDialog.scopeType === 'TEAM' && openWeeks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWeekDialog(prev => ({ ...prev, weekMode: 'existing' }))}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          padding: '14px 16px', borderRadius: '0', cursor: 'pointer', textAlign: 'left',
                          border: `2px solid ${weekDialog.weekMode === 'existing' ? 'var(--tech-blue)' : 'var(--glass-border)'}`,
                          background: weekDialog.weekMode === 'existing' ? 'rgba(75,159,225,0.06)' : 'var(--surface-input)',
                          transition: 'border-color 0.1s ease',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                          Add to Existing Open Week
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem' }}>
                          Adds the selected teams to an existing open week (same deadline).
                        </span>
                      </button>
                    )}
                  </div>

                  {weekDialog.weekMode === 'existing' && openWeeks.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginBottom: '6px' }}>
                        Select Open Week
                      </label>
                      <select
                        className="form-select"
                        value={weekDialog.existingWeekId}
                        onChange={e => setWeekDialog(prev => ({ ...prev, existingWeekId: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.82rem' }}
                      >
                        <option value="">Choose a week...</option>
                        {openWeeks.map(w => (
                          <option key={w.week_id} value={w.week_id}>
                            Week {w.week_number} — closes {new Date(w.closes_at).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Deadline (only for new cycle) */}
              {weekDialogStep === 4 && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    Deadline (Optional)
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', marginBottom: '12px' }}>
                    Leave blank to use the default: 7 days from now at 11:59 PM ET.
                  </p>

                  {weekDialog.weekMode === 'new' ? (
                    <div>
                      <label style={{ display: 'block', color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', marginBottom: '6px' }}>
                        Custom Close Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={weekDialog.customClosesAt}
                        onChange={e => setWeekDialog(prev => ({ ...prev, customClosesAt: e.target.value }))}
                        style={{ width: '100%', fontSize: '0.82rem' }}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '12px 14px', background: 'var(--surface-input)', borderRadius: '0', border: '1px solid var(--glass-border)' }}>
                      <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem', margin: 0 }}>
                        Adding to existing week — deadline is set by that week.
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(75,159,225,0.05)', border: '1px solid rgba(75,159,225,0.15)', borderRadius: '0' }}>
                    <p style={{ color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Summary
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem' }}>
                        Scope: <strong>{weekDialog.scopeType === 'ALL' ? 'All Teams' : `Teams: ${weekDialog.selectedTeamKeys.join(', ')}`}</strong>
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.78rem' }}>
                        Mode: <strong>{weekDialog.weekMode === 'new' ? 'New Cycle' : `Add to Week ${openWeeks.find(w => w.week_id === weekDialog.existingWeekId)?.week_number ?? '?'}`}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {weekError && (
                <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '0', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.75rem' }}>
                  {weekError}
                </div>
              )}

              {/* Dialog footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={weekDialogStep === 1 ? closeWeekDialog : dialogBack}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', padding: '8px 0' }}
                >
                  {weekDialogStep === 1 ? 'Cancel' : 'Back'}
                </button>

                {weekDialogStep < 4 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={dialogNext}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
                  >
                    Next
                    <ChevronRight width={14} height={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-cta"
                    onClick={handleCreateWeek}
                    disabled={creatingWeek}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '9px 18px' }}
                  >
                    <Plus width={14} height={14} />
                    {creatingWeek ? 'Creating...' : weekDialog.weekMode === 'existing' ? 'Add Teams to Week' : 'Create Week'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
