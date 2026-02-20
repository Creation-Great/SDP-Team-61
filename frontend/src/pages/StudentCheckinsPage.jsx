import { useEffect, useMemo, useState } from 'react';
import API from '../services/api';

function normalizeWeeks(instructorWeeks, selfWeeks, topics, members) {
  const existingById = new Map((selfWeeks || []).map((w) => [w.id, w]));

  return (instructorWeeks || []).map((w, idx) => {
    const id = w?.id || `week-${idx + 1}`;
    const existing = existingById.get(id) || {};

    const peerScores = { ...(existing.peer_scores || {}) };
    (members || []).forEach((member) => {
      peerScores[member.id] = { ...(peerScores[member.id] || {}) };
      (topics || []).forEach((topic) => {
        if (peerScores[member.id][topic] === undefined) {
          peerScores[member.id][topic] = '';
        }
      });
    });

    return {
      id,
      label: w?.label || `Week ${idx + 1}`,
      self_score: existing.self_score || '',
      peer_scores: peerScores,
    };
  });
}

export default function StudentCheckinsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [topics, setTopics] = useState([]);
  const [members, setMembers] = useState([]);
  const [selfWeeks, setSelfWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const selectedWeek = useMemo(
    () => selfWeeks.find((w) => w.id === selectedWeekId) || null,
    [selfWeeks, selectedWeekId]
  );

  const linkedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const teamPeers = useMemo(() => {
    if (!linkedMember) return [];
    return members.filter((m) => m.team === linkedMember.team && m.id !== linkedMember.id);
  }, [members, linkedMember]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await API.get('/checkins/context');
        if (cancelled) return;

        const instructor = res.data?.instructor;
        const self = res.data?.self;
        if (!instructor) {
          setError('No instructor check-ins found for your course/group yet.');
          return;
        }

        const loadedTopics = Array.isArray(instructor.topics) ? instructor.topics : [];
        const loadedMembers = Array.isArray(instructor.members) ? instructor.members : [];
        const instructorWeeks = Array.isArray(instructor.weeks) ? instructor.weeks : [];
        const selectedId = self?.selected_member_id || '';

        setTopics(loadedTopics);
        setMembers(loadedMembers);
        setSelectedMemberId(selectedId);

        const normalized = normalizeWeeks(instructorWeeks, self?.weeks || [], loadedTopics, loadedMembers);
        setSelfWeeks(normalized);
        setSelectedWeekId(normalized[0]?.id || '');
      } catch {
        setError('Failed to load student check-ins');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSelfScore = (weekId, value) => {
    setSelfWeeks((prev) =>
      prev.map((week) => (week.id === weekId ? { ...week, self_score: value } : week))
    );
  };

  const setPeerScore = (weekId, memberId, topic, value) => {
    setSelfWeeks((prev) =>
      prev.map((week) => {
        if (week.id !== weekId) return week;
        return {
          ...week,
          peer_scores: {
            ...(week.peer_scores || {}),
            [memberId]: {
              ...((week.peer_scores || {})[memberId] || {}),
              [topic]: value,
            },
          },
        };
      })
    );
  };

  const saveSelfCheckins = async () => {
    setError('');
    setStatus('');
    if (!selectedMemberId) {
      setError('Your account is not linked to a template row yet.');
      return;
    }

    setSaving(true);
    try {
      await API.post('/checkins/self', {
        selected_member_id: selectedMemberId,
        weeks: selfWeeks,
      });
      setStatus('Weekly ratings saved');
    } catch {
      setError('Failed to save weekly ratings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="empty-state"><p>Loading check-ins...</p></div>;
  }

  return (
    <div>
      <h1 className="page-title">My Check-ins</h1>
      <p className="page-subtitle">
        Rate yourself and your teammates each week.
      </p>

      <div className="card mb-16">
        <p className="card-meta">
          Linked row:{' '}
          {linkedMember ? `Team ${linkedMember.team} - ${linkedMember.name}` : 'Not linked yet'}
        </p>
        {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}
        {status && <p className="success-text">{status}</p>}
      </div>

      {selfWeeks.length > 0 && (
        <div className="card mb-16">
          <div className="flex-row flex-wrap gap-8">
            {selfWeeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className={`btn btn-md ${selectedWeekId === week.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedWeekId(week.id)}
              >
                {week.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedWeek && (
        <div className="card mb-16 overflow-x-auto">
          <h3 className="card-title">{selectedWeek.label} Ratings</h3>

          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label className="form-label">Self Score</label>
            <select
              className="form-select"
              value={selectedWeek.self_score || ''}
              onChange={(e) => setSelfScore(selectedWeek.id, e.target.value)}
            >
              <option value="">-</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          <h4 className="mb-8">Teammate Ratings</h4>
          {teamPeers.length === 0 ? (
            <p className="card-meta">No teammates found in your linked team.</p>
          ) : (
            <table className="table-full">
              <caption className="sr-only">Teammate ratings by topic for the selected week</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  {topics.map((topic) => (
                    <th scope="col" key={topic}>{topic}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamPeers.map((peer) => (
                  <tr key={peer.id}>
                    <td>{peer.name}</td>
                    {topics.map((topic) => (
                      <td key={`${peer.id}-${topic}`}>
                        <select
                          className="form-select"
                          value={selectedWeek.peer_scores?.[peer.id]?.[topic] || ''}
                          onChange={(e) => setPeerScore(selectedWeek.id, peer.id, topic, e.target.value)}
                          style={{ minWidth: '100px' }}
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
          )}

          <div className="mt-12 flex-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveSelfCheckins}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save My Weekly Scores'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
