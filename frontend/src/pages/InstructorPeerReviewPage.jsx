import { useEffect, useMemo, useState } from 'react';
import API from '../services/api';

const RESERVED_HEADERS = new Set(['team', 'name', 'self', 'individual comments']);

function parseCsvLine(line) {
  const out = [];
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

function parseCsv(text) {
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

function toScore(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (!str.includes(',') && !str.includes('"') && !str.includes('\n')) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function buildDefaultWeek(id, label, members, topics) {
  const scores = {};
  const comments = {};
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
  const [headers, setHeaders] = useState([]);
  const [topics, setTopics] = useState([]);
  const [members, setMembers] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [mode, setMode] = useState('upload');
  const [studentOptions, setStudentOptions] = useState([]);
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [insights, setInsights] = useState([]);
  const [handedOut, setHandedOut] = useState([]);
  const [selectedRaterMemberId, setSelectedRaterMemberId] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadSaved = async () => {
      try {
        const studentsRes = await API.get('/instructor/checkins/students');
        if (!cancelled) {
          setStudentOptions(Array.isArray(studentsRes.data) ? studentsRes.data : []);
        }

        const res = await API.get('/instructor/checkins/current');
        if (cancelled) return;
        const data = res.data;
        setFileName(data.file_name || '');
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
      } catch (err) {
        if (err?.response?.status !== 404) {
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
      const res = await API.get('/instructor/checkins/insights');
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

  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.id === selectedWeekId) || null,
    [weeks, selectedWeekId]
  );

  const memberLabelById = useMemo(() => {
    const map = new Map();
    members.forEach((m) => map.set(m.id, `Team ${m.team} - ${m.name}`));
    return map;
  }, [members]);

  const selectedRaterWeekData = useMemo(() => {
    if (!selectedRaterMemberId || !selectedWeekId) return null;
    const rater = handedOut.find((h) => h.rater_member_id === selectedRaterMemberId);
    if (!rater) return null;
    return (rater.weeks || []).find((w) => w.id === selectedWeekId) || null;
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
    const byMember = {};
    members.forEach((member) => {
      byMember[member.id] = {};
      topics.forEach((topic) => {
        let sum = 0;
        let count = 0;
        weeks.forEach((week) => {
          const raw = week.scores?.[member.id]?.[topic];
          const n = toScore(raw);
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

  const loadTemplate = async (event) => {
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

      const mappedMembers = parsed.rows
        .map((row, idx) => {
          const team = (row[teamIdx] || '').trim();
          const name = (row[nameIdx] || '').trim();
          if (!team || !name) return null;
          const matched = studentOptions.find(
            (s) => normalizeName(s.display_name) === normalizeName(name)
          );
          return {
            id: `${team}::${name}::${idx}`,
            team,
            name,
            self: selfIdx >= 0 ? (row[selfIdx] || '').trim() : '',
            base_comment: commentsIdx >= 0 ? (row[commentsIdx] || '').trim() : '',
            mapped_user_id: matched?.user_id || null,
          };
        })
        .filter(Boolean);

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

  const setWeeklyScore = (weekId, memberId, topic, value) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          scores: {
            ...week.scores,
            [memberId]: {
              ...(week.scores[memberId] || {}),
              [topic]: value,
            },
          },
        };
      })
    );
  };

  const setWeeklyComment = (weekId, memberId, value) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          comments: {
            ...(week.comments || {}),
            [memberId]: value,
          },
        };
      })
    );
  };

  const setWeeklyAdditionalComments = (weekId, value) => {
    setWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          additional_comments: value,
        };
      })
    );
  };

  const setMemberMapping = (memberId, mappedUserId) => {
    setMembers((prev) =>
      prev.map((member) => {
        if (member.id !== memberId) return member;
        return {
          ...member,
          mapped_user_id: mappedUserId || null,
        };
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
      const row = headers.map(() => '');
      if (teamIdx >= 0) row[teamIdx] = m.team;
      if (nameIdx >= 0) row[nameIdx] = m.name;
      if (selfIdx >= 0) row[selfIdx] = m.self;
      if (commentsIdx >= 0) {
        const selectedComment = selectedWeek?.comments?.[m.id] || '';
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
      <h1 className="page-title">Student Check-ins</h1>
      <p className="page-subtitle">
        Upload one template CSV, score weekly, submit weekly scores, and keep rolling per-student averages.
      </p>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <button
            type="button"
            className={`btn ${mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('existing')}
            disabled={members.length === 0}
            style={{ padding: '8px 12px', fontSize: '0.9rem' }}
          >
            Update Existing
          </button>
          <button
            type="button"
            className={`btn ${mode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('upload')}
            style={{ padding: '8px 12px', fontSize: '0.9rem' }}
          >
            Upload New CSV
          </button>
        </div>
        {mode === 'upload' && (
          <div className="form-group">
            <label className="form-label" htmlFor="template-csv-upload">Template CSV</label>
            <input id="template-csv-upload" type="file" accept=".csv,text/csv" onChange={loadTemplate} />
          </div>
        )}
        {mode === 'existing' && members.length > 0 && (
          <p className="card-meta">Editing stored check-ins. Use "Submit Weekly Scores" to persist updates.</p>
        )}
        {loadingSaved && <p className="card-meta">Loading saved data...</p>}
        {fileName && <p className="card-meta">Loaded: {fileName}</p>}
        {status && <p className="success-text">{status}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      {members.length > 0 && showMappingPanel && (
        <div className="card" style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <h3 className="card-title">Verify Template Name To User Mapping</h3>
          <p className="card-meta">Map each template row to a real student account so student check-ins auto-link correctly.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Team</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Template Name</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Mapped User</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={`${member.id}-map`}>
                  <td style={{ padding: '8px 4px' }}>{member.team}</td>
                  <td style={{ padding: '8px 4px' }}>{member.name}</td>
                  <td style={{ padding: '8px 4px', minWidth: '260px' }}>
                    <select
                      className="form-select"
                      value={member.mapped_user_id || ''}
                      onChange={(e) => setMemberMapping(member.id, e.target.value)}
                    >
                      <option value="">Unmapped</option>
                      {studentOptions.map((student) => (
                        <option key={student.user_id} value={student.user_id}>
                          {student.display_name} ({student.email || 'no-email'})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {weeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className={`btn ${selectedWeekId === week.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedWeekId(week.id)}
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
              >
                {week.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addWeek}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              + Add Week
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowComments((v) => !v)}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              {showComments ? 'Hide Comments' : 'Show Comments'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportRollingCsv}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            >
              Export Rolling CSV
            </button>
          </div>
        </div>
      )}

      {selectedWeek && (
        <div className="card" style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <h3 className="card-title">{selectedWeek.label} Scores</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Team</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Name</th>
                {topics.map((topic) => (
                  <th key={topic} style={{ textAlign: 'left', padding: '8px 4px' }}>{topic}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td style={{ padding: '8px 4px' }}>{member.team}</td>
                  <td style={{ padding: '8px 4px' }}>{member.name}</td>
                  {topics.map((topic) => (
                    <td key={`${member.id}-${topic}`} style={{ padding: '8px 4px' }}>
                      <select
                        className="form-select"
                        value={selectedWeek.scores?.[member.id]?.[topic] || ''}
                        onChange={(e) => setWeeklyScore(selectedWeek.id, member.id, topic, e.target.value)}
                        style={{ minWidth: '90px', padding: '8px 10px' }}
                      >
                        <option value="">-</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitCurrentWeek}
              disabled={submitting || !selectedWeek}
              style={{ padding: '10px 14px' }}
            >
              {submitting ? 'Submitting...' : 'Submit Weekly Scores'}
            </button>
          </div>
        </div>
      )}

      {showComments && selectedWeek && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 className="card-title">{selectedWeek.label} Comments</h3>
          <div className="form-group">
            <label className="form-label">Additional Comments (Week-level)</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Overall observations for this week..."
              value={selectedWeek.additional_comments || ''}
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
                value={selectedWeek.comments?.[member.id] || ''}
                onChange={(e) => setWeeklyComment(selectedWeek.id, member.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {members.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <h3 className="card-title">Student Submission Aggregates</h3>
          <p className="card-meta">Self is one aggregated score from student self-ratings. Click a student to see scores they handed out for the selected week.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Team</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Self (Agg)</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Peer (Agg)</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Instructor (Agg)</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((row) => (
                <tr key={`insight-${row.member_id}`}>
                  <td style={{ padding: '8px 4px' }}>{row.team}</td>
                  <td style={{ padding: '8px 4px' }}>{row.name}</td>
                  <td style={{ padding: '8px 4px' }}>{row.self_average ?? 'N/A'}</td>
                  <td style={{ padding: '8px 4px' }}>{row.peer_average ?? 'N/A'}</td>
                  <td style={{ padding: '8px 4px' }}>{row.instructor_average ?? 'N/A'}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <button
                      type="button"
                      className={`btn ${selectedRaterMemberId === row.member_id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSelectedRaterMemberId(row.member_id)}
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                    >
                      View Week Scores
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRaterWeekData && (
        <div className="card" style={{ marginBottom: '16px', overflowX: 'auto' }}>
          <h3 className="card-title">
            {memberLabelById.get(selectedRaterMemberId) || selectedRaterMemberId} - Scores Handed Out ({selectedWeek?.label || selectedWeekId})
          </h3>
          <p className="card-meta">Self score submitted this week: {selectedRaterWeekData.self_score || 'N/A'}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Rated Student</th>
                {topics.map((topic) => (
                  <th key={`handed-topic-${topic}`} style={{ textAlign: 'left', padding: '8px 4px' }}>{topic}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(selectedRaterWeekData.peer_scores || {}).map(([targetId, topicScores]) => (
                <tr key={`handed-row-${targetId}`}>
                  <td style={{ padding: '8px 4px' }}>{memberLabelById.get(targetId) || targetId}</td>
                  {topics.map((topic) => (
                    <td key={`handed-cell-${targetId}-${topic}`} style={{ padding: '8px 4px' }}>
                      {topicScores?.[topic] || 'N/A'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Rolling Per-User Averages</h3>
            <div style={{ minWidth: '180px' }}>
              <select
                className="form-select"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                style={{ padding: '8px 10px' }}
              >
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team === 'ALL' ? 'All Teams' : `Team ${team}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Team</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Name</th>
                {topics.map((topic) => (
                  <th key={topic} style={{ textAlign: 'left', padding: '8px 4px' }}>{topic}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: '8px 4px' }}>{m.team}</td>
                  <td style={{ padding: '8px 4px' }}>{m.name}</td>
                  {topics.map((topic) => (
                    <td key={`${m.id}-roll-${topic}`} style={{ padding: '8px 4px' }}>
                      {rollingByMember?.[m.id]?.[topic] ?? 'N/A'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
