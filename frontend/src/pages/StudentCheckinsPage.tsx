import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import API from '../services/api';
import type { CheckinMember, StudentCheckinContext, StudentCheckinWeek } from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/animated-table';

function normalizeWeeks(
  instructorWeeks: { id: string; label: string }[],
  selfWeeks: StudentCheckinWeek[],
  topics: string[],
  members: CheckinMember[]
): StudentCheckinWeek[] {
  const existingById = new Map((selfWeeks ?? []).map(w => [w.id, w]));
  return (instructorWeeks ?? []).map((w, idx) => {
    const id = w?.id ?? `week-${idx + 1}`;
    const existing = existingById.get(id) ?? ({} as Partial<StudentCheckinWeek>);
    const peerScores: StudentCheckinWeek['peer_scores'] = { ...(existing.peer_scores ?? {}) };
    (members ?? []).forEach(member => {
      peerScores[member.id] = { ...(peerScores[member.id] ?? {}) };
      (topics ?? []).forEach(topic => {
        if (peerScores[member.id][topic] === undefined) peerScores[member.id][topic] = '';
      });
    });
    return { id, label: w?.label ?? `Week ${idx + 1}`, self_score: existing.self_score ?? '', peer_scores: peerScores };
  });
}

export default function StudentCheckinsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [members, setMembers] = useState<CheckinMember[]>([]);
  const [selfWeeks, setSelfWeeks] = useState<StudentCheckinWeek[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const selectedWeek = useMemo(() => selfWeeks.find(w => w.id === selectedWeekId) ?? null, [selfWeeks, selectedWeekId]);
  const linkedMember = useMemo(() => members.find(m => m.id === selectedMemberId) ?? null, [members, selectedMemberId]);
  const teamPeers = useMemo(() => {
    if (!linkedMember) return [];
    return members.filter(m => m.team === linkedMember.team && m.id !== linkedMember.id);
  }, [members, linkedMember]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await API.get<StudentCheckinContext>('/checkins/context');
        if (cancelled) return;
        const instructor = res.data?.instructor;
        const self = res.data?.self;
        if (!instructor) { setError('No instructor check-ins found for your course/group yet.'); return; }
        const loadedTopics = Array.isArray(instructor.topics) ? instructor.topics : [];
        const loadedMembers = Array.isArray(instructor.members) ? instructor.members : [];
        const instructorWeeks = Array.isArray(instructor.weeks) ? instructor.weeks : [];
        const selectedId = self?.selected_member_id ?? '';
        setTopics(loadedTopics);
        setMembers(loadedMembers);
        setSelectedMemberId(selectedId);
        const normalized = normalizeWeeks(instructorWeeks, self?.weeks ?? [], loadedTopics, loadedMembers);
        setSelfWeeks(normalized);
        setSelectedWeekId(normalized[0]?.id ?? '');
      } catch {
        setError('Failed to load student check-ins');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const setSelfScore = (weekId: string, value: string) =>
    setSelfWeeks(prev => prev.map(week => (week.id === weekId ? { ...week, self_score: value } : week)));

  const setPeerScore = (weekId: string, memberId: string, topic: string, value: string) =>
    setSelfWeeks(prev =>
      prev.map(week => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          peer_scores: { ...(week.peer_scores ?? {}), [memberId]: { ...((week.peer_scores ?? {})[memberId] ?? {}), [topic]: value } },
        };
      })
    );

  const saveSelfCheckins = async () => {
    setError('');
    setStatus('');
    if (!selectedMemberId) { setError('Your account is not linked to a template row yet.'); return; }
    setSaving(true);
    try {
      await API.post('/checkins/self', { selected_member_id: selectedMemberId, weeks: selfWeeks });
      setStatus('Weekly ratings saved');
    } catch {
      setError('Failed to save weekly ratings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem' }}>Loading check-ins...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="My Check-ins" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Rate yourself and your teammates each week.
        </p>
      </div>

      {/* Status card */}
      <motion.div
        className="card"
        style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
          background: linkedMember ? 'var(--success)' : 'var(--text-muted)',
          boxShadow: linkedMember ? '0 0 8px rgba(61,187,121,0.5)' : 'none',
        }} />
        <p className="card-meta" style={{ margin: 0 }}>
          {linkedMember
            ? <>Linked to: <strong style={{ color: 'var(--text-primary)' }}>Team {linkedMember.team} — {linkedMember.name}</strong></>
            : 'Not linked to a template row yet'}
        </p>
        {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
        {status && <p className="success-text" style={{ margin: 0 }}>✓ {status}</p>}
      </motion.div>

      {/* Week selector */}
      {selfWeeks.length > 0 && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {selfWeeks.map(week => (
              <button
                key={week.id}
                type="button"
                className={`week-pill${selectedWeekId === week.id ? ' active' : ''}`}
                onClick={() => setSelectedWeekId(week.id)}
              >
                {week.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Ratings for selected week */}
      {selectedWeek && (
        <motion.div
          className="card"
          style={{ marginBottom: '16px', overflowX: 'auto' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <h3 className="card-title">{selectedWeek.label} Ratings</h3>

          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label className="form-label">Self Score</label>
            <select
              className="form-select"
              value={selectedWeek.self_score ?? ''}
              onChange={e => setSelfScore(selectedWeek.id, e.target.value)}
            >
              <option value="">-</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Teammate Ratings
          </h4>

          {teamPeers.length === 0 ? (
            <p className="card-meta">No teammates found in your linked team.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {topics.map(topic => (
                    <TableHead key={topic}>{topic}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamPeers.map((peer, idx) => (
                  <motion.tr
                    key={peer.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    style={{ borderBottom: '1px solid var(--glass-border)' }}
                  >
                    <TableCell style={{ fontWeight: 600 }}>{peer.name}</TableCell>
                    {topics.map(topic => (
                      <TableCell key={`${peer.id}-${topic}`}>
                        <select
                          className="form-select"
                          value={selectedWeek.peer_scores?.[peer.id]?.[topic] ?? ''}
                          onChange={e => setPeerScore(selectedWeek.id, peer.id, topic, e.target.value)}
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
          )}

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-cta" onClick={saveSelfCheckins} disabled={saving}>
              {saving ? 'Saving...' : 'Save My Weekly Scores'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
