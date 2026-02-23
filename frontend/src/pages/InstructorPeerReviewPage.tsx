import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import API from '../services/api';
import type {
  CheckinMember,
  CheckinWeek,
  InsightRow,
  HandedOutEntry,
  StudentOption,
  WeekScores,
  WeekComments,
} from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/animated-table';

const RESERVED_HEADERS = new Set(['team', 'name', 'self', 'individual comments']);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return {
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map(parseCsvLine),
  };
}

function toScore(value: string | number | undefined): number | null {
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

function csvEscape(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (!str.includes(',') && !str.includes('"') && !str.includes('\n')) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function buildDefaultWeek(
  id: string,
  label: string,
  members: CheckinMember[],
  topics: string[]
): CheckinWeek {
  const scores: WeekScores = {};
  const comments: WeekComments = {};
  members.forEach((m) => {
    scores[m.id] = {};
    comments[m.id] = '';
    topics.forEach((t) => {
      scores[m.id][t] = '';
    });
  });
  return { id, label, scores, comments, additional_comments: '' };
}

export default function InstructorPeerReviewPage() {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [members, setMembers] = useState<CheckinMember[]>([]);
  const [weeks, setWeeks] = useState<CheckinWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [mode, setMode] = useState<'upload' | 'existing'>('upload');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [handedOut, setHandedOut] = useState<HandedOutEntry[]>([]);
  const [selectedRaterMemberId, setSelectedRaterMemberId] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const studentsRes = await API.get<StudentOption[]>('/instructor/checkins/students');
        if (!cancelled) {
          setStudentOptions(Array.isArray(studentsRes.data) ? studentsRes.data : []);
        }

        const res = await API.get<{
          file_name?: string;
          headers?: string[];
          topics?: string[];
          members?: CheckinMember[];
          weeks?: CheckinWeek[];
        }>('/instructor/checkins/current');
        if (cancelled) return;
        const data = res.data;
        setFileName(data.file_name ?? '');
        setHeaders(Array.isArray(data.headers) ? data.headers : []);
        setTopics(Array.isArray(data.topics) ? data.topics : []);
        setMembers(Array.isArray(data.members) ? data.members : []);

        const loadedWeeks = Array.isArray(data.weeks) ? data.weeks : [];
        const normalizedWeeks = loadedWeeks.map((w) => ({
          ...w,
          comments: w.comments || {},
          scores: w.scores || {},
          additional_comments: w.additional_comments || '',
        }));
        setWeeks(normalizedWeeks);
        if (normalizedWeeks.length > 0) {
          setSelectedWeekId(normalizedWeeks[0].id);
          setStatus('Loaded saved check-ins');
          setMode('existing');
          setShowMappingPanel(false);
        }
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e?.response?.status !== 404) {
          setError('Failed to load saved check-ins');
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    };
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await API.get<{ insights?: InsightRow[]; handed_out?: HandedOutEntry[] }>(
        '/instructor/checkins/insights'
      );
      setInsights(Array.isArray(res.data?.insights) ? res.data.insights : []);
      setHandedOut(Array.isArray(res.data?.handed_out) ? res.data.handed_out : []);
    } catch {
      setInsights([]);
      setHandedOut([]);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const normalizeName = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.id === selectedWeekId) ?? null,
    [weeks, selectedWeekId]
  );

  const memberLabelById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, `Team ${m.team} - ${m.name}`));
    return map;
  }, [members]);

  const selectedRaterWeekData = useMemo(() => {
    if (!selectedRaterMemberId || !selectedWeekId) return null;
    const rater = handedOut.find((h) => h.rater_member_id === selectedRaterMemberId);
    if (!rater) return null;
    return (rater.weeks ?? []).find((w) => w.id === selectedWeekId) ?? null;
  }, [handedOut, selectedRaterMemberId, selectedWeekId]);

  const teams = useMemo(() => {
    const unique = Array.from(new Set(members.map((m) => m.team).filter(Boolean))).sort();
    return ['ALL', ...unique];
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (teamFilter === 'ALL') return members;
    return members.filter((m) => m.team === teamFilter);
  }, [members, teamFilter]);

  const rollingByMember = useMemo(() => {
    const byMember: Record<string, Record<string, number | null>> = {};
    members.forEach((member) => {
      byMember[member.id] = {};
      topics.forEach((topic) => {
        let sum = 0;
        let count = 0;
        weeks.forEach((week) => {
          const raw = week.scores?.[member.id]?.[topic];
          const n = toScore(raw as string | number | undefined);
          if (n !== null) {
            sum += n;
            count += 1;
          }
        });
        byMember[member.id][topic] = count > 0 ? Number((sum / count).toFixed(2)) : null;
      });
    });
    return byMember;
  }, [members, topics, weeks]);

  const saveCheckins = async (message = 'Saved') => {
    await API.post('/instructor/checkins/current', {
      file_name: fileName,
      headers,
      topics,
      members,
      weeks,
    });
    setStatus(message);
  };

  const submitCurrentWeek = async () => {
    if (!selectedWeek) return;
    setError('');
    setStatus('');
    setSubmitting(true);
    try {
      await saveCheckins(`${selectedWeek.label} submitted`);
      setShowMappingPanel(false);
      await fetchInsights();
    } catch {
      setError('Failed to submit weekly scores');
    } finally {
      setSubmitting(false);
    }
  };

  const loadTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setStatus('');
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setError('CSV is empty.');
        return;
      }

      const lowerHeaders = parsed.headers.map((h) => h.toLowerCase());
      const teamIdx = lowerHeaders.indexOf('team');
      const nameIdx = lowerHeaders.indexOf('name');
      const selfIdx = lowerHeaders.indexOf('self');
      const commentsIdx = lowerHeaders.indexOf('individual comments');

      if (teamIdx === -1 || nameIdx === -1) {
        setError('CSV must include Team and Name columns.');
        return;
      }

      const topicCols = parsed.headers.filter((h) => !RESERVED_HEADERS.has(h.toLowerCase()));
      if (topicCols.length === 0) {
        setError('No grading topics found.');
        return;
      }

      const mappedMembers: CheckinMember[] = parsed.rows
        .map((row, idx): CheckinMember | null => {
          const team = (row[teamIdx] ?? '').trim();
          const name = (row[nameIdx] ?? '').trim();
          if (!team || !name) return null;
          const matched = studentOptions.find(
            (s) => normalizeName(s.display_name) === normalizeName(name)
          );
          return {
            id: `${team}::${name}::${idx}`,
            team,
            name,
            self: selfIdx >= 0 ? (row[selfIdx] ?? '').trim() : '',
            base_comment: commentsIdx >= 0 ? (row[commentsIdx] ?? '').trim() : '',
            mapped_user_id: matched?.user_id ?? null,
          };
        })
        .filter((m): m is CheckinMember => m !== null);

      const week1 = buildDefaultWeek('week-1', 'Week 1', mappedMembers, topicCols);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setTopics(topicCols);
      setMembers(mappedMembers);
      setWeeks([week1]);
      setSelectedWeekId('week-1');
      setTeamFilter('ALL');
      setShowComments(false);
      setMode('existing');
      setShowMappingPanel(true);
      setStatus('Template loaded');
    } catch {
      setError('Failed to parse CSV template.');
    }
  };

  const addWeek = () => {
    if (members.length === 0 || topics.length === 0) return;
    const nextNum = weeks.length + 1;
    const id = `week-${nextNum}`;
    const newWeek = buildDefaultWeek(id, `Week ${nextNum}`, members, topics);
    setWeeks((prev) => [...prev, newWeek]);
    setSelectedWeekId(id);
  };

  const setWeeklyScore = (weekId: string, memberId: string, topic: string, value: string) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          scores: {
            ...week.scores,
            [memberId]: {
              ...(week.scores[memberId] ?? {}),
              [topic]: value,
            },
          },
        };
      })
    );
  };

  const setWeeklyComment = (weekId: string, memberId: string, value: string) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          comments: {
            ...(week.comments ?? {}),
            [memberId]: value,
          },
        };
      })
    );
  };

  const setWeeklyAdditionalComments = (weekId: string, value: string) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return { ...week, additional_comments: value };
      })
    );
  };

  const setMemberMapping = (memberId: string, mappedUserId: string) => {
    setMembers((prev) =>
      prev.map((member) => {
        if (member.id !== memberId) return member;
        return { ...member, mapped_user_id: mappedUserId || null };
      })
    );
  };

  const exportRollingCsv = () => {
    if (members.length === 0) return;
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const teamIdx = lowerHeaders.indexOf('team');
    const nameIdx = lowerHeaders.indexOf('name');
    const selfIdx = lowerHeaders.indexOf('self');
    const commentsIdx = lowerHeaders.indexOf('individual comments');

    const lines = [headers.map(csvEscape).join(',')];
    members.forEach((m) => {
      const row: (string | number | null | undefined)[] = headers.map(() => '');
      if (teamIdx >= 0) row[teamIdx] = m.team;
      if (nameIdx >= 0) row[nameIdx] = m.name;
      if (selfIdx >= 0) row[selfIdx] = m.self;
      if (commentsIdx >= 0) {
        const selectedComment = selectedWeek?.comments?.[m.id] ?? '';
        row[commentsIdx] = selectedComment || m.base_comment || '';
      }
      topics.forEach((topic) => {
        const idx = headers.indexOf(topic);
        if (idx >= 0) {
          const avg = rollingByMember?.[m.id]?.[topic];
          row[idx] = avg === null || avg === undefined ? '' : String(avg);
        }
      });
      lines.push(row.map(csvEscape).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rolling-averages-${fileName || 'peer-review.csv'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Student Check-ins" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Upload one template CSV, score weekly, submit weekly scores, and keep rolling per-student averages.
        </p>
      </div>

      {/* Mode / upload card */}
      <motion.div
        className="card"
        style={{ marginBottom: '16px' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <button
            type="button"
            className={`week-pill${mode === 'existing' ? ' active' : ''}`}
            onClick={() => setMode('existing')}
            disabled={members.length === 0}
          >
            Update Existing
          </button>
          <button
            type="button"
            className={`week-pill${mode === 'upload' ? ' active' : ''}`}
            onClick={() => setMode('upload')}
          >
            Upload New CSV
          </button>
        </div>
        {mode === 'upload' && (
          <div className="form-group">
            <label className="form-label" htmlFor="template-csv-upload">
              Template CSV
            </label>
            <input
              id="template-csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={loadTemplate}
            />
          </div>
        )}
        {mode === 'existing' && members.length > 0 && (
          <p className="card-meta">
            Editing stored check-ins. Use &ldquo;Submit Weekly Scores&rdquo; to persist updates.
          </p>
        )}
        {loadingSaved && <p className="card-meta">Loading saved data...</p>}
        {fileName && <p className="card-meta" style={{ color: 'var(--tech-blue)' }}>✓ Loaded: {fileName}</p>}
        {status && <p className="success-text">✓ {status}</p>}
        {error && <p className="error-text">{error}</p>}
      </motion.div>

      {/* Mapping panel */}
      {members.length > 0 && showMappingPanel && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px', overflowX: 'auto' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <h3 className="card-title">Verify Template Name To User Mapping</h3>
          <p className="card-meta" style={{ marginBottom: '12px' }}>
            Map each template row to a real student account so student check-ins auto-link correctly.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Template Name</TableHead>
                <TableHead>Mapped User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member, idx) => (
                <motion.tr
                  key={`${member.id}-map`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ borderBottom: '1px solid var(--glass-border)' }}
                >
                  <TableCell>{member.team}</TableCell>
                  <TableCell style={{ fontWeight: 600 }}>{member.name}</TableCell>
                  <TableCell style={{ minWidth: '260px' }}>
                    <select
                      className="form-select"
                      value={member.mapped_user_id ?? ''}
                      onChange={(e) => setMemberMapping(member.id, e.target.value)}
                    >
                      <option value="">Unmapped</option>
                      {studentOptions.map((student) => (
                        <option key={student.user_id} value={student.user_id}>
                          {student.display_name} ({student.email ?? 'no-email'})
                        </option>
                      ))}
                    </select>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Week selector */}
      {members.length > 0 && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {weeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className={`week-pill${selectedWeekId === week.id ? ' active' : ''}`}
                onClick={() => setSelectedWeekId(week.id)}
              >
                {week.label}
              </button>
            ))}
            <button type="button" className="week-pill" onClick={addWeek}>+ Add Week</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowComments(v => !v)}>
              {showComments ? 'Hide Comments' : 'Show Comments'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportRollingCsv}>
              Export Rolling CSV
            </button>
          </div>
        </motion.div>
      )}

      {/* Weekly scores grid */}
      {selectedWeek && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px', overflowX: 'auto' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <h3 className="card-title">{selectedWeek.label} Scores</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Name</TableHead>
                {topics.map(topic => (
                  <TableHead key={topic}>{topic}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member, idx) => (
                <motion.tr
                  key={member.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ borderBottom: '1px solid var(--glass-border)' }}
                >
                  <TableCell>{member.team}</TableCell>
                  <TableCell style={{ fontWeight: 600 }}>{member.name}</TableCell>
                  {topics.map(topic => (
                    <TableCell key={`${member.id}-${topic}`}>
                      <select
                        className="form-select"
                        value={(selectedWeek.scores?.[member.id]?.[topic] as string) ?? ''}
                        onChange={e => setWeeklyScore(selectedWeek.id, member.id, topic, e.target.value)}
                        style={{ minWidth: '90px' }}
                      >
                        <option value="">-</option>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </TableCell>
                  ))}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-cta" onClick={submitCurrentWeek} disabled={submitting || !selectedWeek}>
              {submitting ? 'Submitting...' : 'Submit Weekly Scores'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Comments panel */}
      {showComments && selectedWeek && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 className="card-title">{selectedWeek.label} Comments</h3>
          <div className="form-group">
            <label className="form-label">Additional Comments (Week-level)</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Overall observations for this week..."
              value={selectedWeek.additional_comments ?? ''}
              onChange={(e) => setWeeklyAdditionalComments(selectedWeek.id, e.target.value)}
            />
          </div>
          {filteredMembers.map((member) => (
            <div key={`${member.id}-comment`} className="form-group">
              <label className="form-label">
                {member.team} - {member.name}
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Week-specific comment"
                value={selectedWeek.comments?.[member.id] ?? ''}
                onChange={(e) => setWeeklyComment(selectedWeek.id, member.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Student submission aggregates */}
      {members.length > 0 && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px', overflowX: 'auto' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
        >
          <h3 className="card-title">Student Submission Aggregates</h3>
          <p className="card-meta" style={{ marginBottom: '12px' }}>
            Self is one aggregated score from student self-ratings. Click a student to see scores they handed out for the selected week.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Self (Agg)</TableHead>
                <TableHead>Peer (Agg)</TableHead>
                <TableHead>Instructor (Agg)</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.map((row, idx) => {
                const selfVal = row.self_average;
                const peerVal = row.peer_average;
                const instrVal = row.instructor_average;
                const scoreColor = (v: number | null) => v === null ? 'var(--text-muted)' : v >= 4 ? 'var(--success)' : v >= 3 ? 'var(--tech-blue)' : 'var(--uconn-orange)';
                return (
                  <motion.tr
                    key={`insight-${row.member_id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    style={{ borderBottom: '1px solid var(--glass-border)' }}
                  >
                    <TableCell>{row.team}</TableCell>
                    <TableCell style={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell style={{ color: scoreColor(selfVal), fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>{selfVal ?? 'N/A'}</TableCell>
                    <TableCell style={{ color: scoreColor(peerVal), fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>{peerVal ?? 'N/A'}</TableCell>
                    <TableCell style={{ color: scoreColor(instrVal), fontWeight: 700, fontFamily: 'Roboto Mono, monospace' }}>{instrVal ?? 'N/A'}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className={`btn btn-sm ${selectedRaterMemberId === row.member_id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedRaterMemberId(row.member_id)}
                      >
                        View Week Scores
                      </button>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Handed-out scores panel */}
      {selectedRaterWeekData && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px', overflowX: 'auto' }}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="card-title">
            {memberLabelById.get(selectedRaterMemberId) ?? selectedRaterMemberId} — Scores Handed Out ({selectedWeek?.label ?? selectedWeekId})
          </h3>
          <p className="card-meta" style={{ marginBottom: '12px' }}>
            Self score this week: <strong style={{ color: 'var(--tech-blue)' }}>{selectedRaterWeekData.self_score ?? 'N/A'}</strong>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rated Student</TableHead>
                {topics.map(topic => (
                  <TableHead key={`handed-topic-${topic}`}>{topic}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(selectedRaterWeekData.peer_scores ?? {}).map(([targetId, topicScores], idx) => (
                <motion.tr
                  key={`handed-row-${targetId}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ borderBottom: '1px solid var(--glass-border)' }}
                >
                  <TableCell style={{ fontWeight: 600 }}>{memberLabelById.get(targetId) ?? targetId}</TableCell>
                  {topics.map(topic => (
                    <TableCell key={`handed-cell-${targetId}-${topic}`} style={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {(topicScores as Record<string, string>)?.[topic] ?? '—'}
                    </TableCell>
                  ))}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Rolling averages */}
      {members.length > 0 && (
        <motion.div
          className="card"
          style={{ overflowX: 'auto' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Rolling Per-User Averages</h3>
            <div style={{ minWidth: '180px' }}>
              <select className="form-select" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
                {teams.map(team => (
                  <option key={team} value={team}>{team === 'ALL' ? 'All Teams' : `Team ${team}`}</option>
                ))}
              </select>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Name</TableHead>
                {topics.map(topic => (
                  <TableHead key={topic}>{topic}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((m, idx) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ borderBottom: '1px solid var(--glass-border)' }}
                >
                  <TableCell>{m.team}</TableCell>
                  <TableCell style={{ fontWeight: 600 }}>{m.name}</TableCell>
                  {topics.map(topic => {
                    const val = rollingByMember?.[m.id]?.[topic];
                    const color = val === null || val === undefined ? 'var(--text-muted)' : val >= 4 ? 'var(--success)' : val >= 3 ? 'var(--tech-blue)' : 'var(--uconn-orange)';
                    return (
                      <TableCell key={`${m.id}-roll-${topic}`} style={{ fontFamily: 'Roboto Mono, monospace', color, fontWeight: val ? 700 : 400 }}>
                        {val ?? '—'}
                      </TableCell>
                    );
                  })}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  );
}
