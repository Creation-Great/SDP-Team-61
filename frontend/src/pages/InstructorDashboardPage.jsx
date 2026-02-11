import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import API from '../services/api';

export default function InstructorDashboardPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/submissions/all')
      .then((res) => setSubmissions(res.data))
      .catch((err) => console.error('Error loading submissions:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading submissions...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Instructor Dashboard</h1>
      <p className="page-subtitle">Monitor all student submissions and review progress.</p>

      {submissions.length === 0 ? (
        <div className="card empty-state">
          <h3>No submissions yet</h3>
          <p>Student submissions will appear here once uploaded.</p>
        </div>
      ) : (
        <div>
          <p className="card-muted" style={{ marginBottom: '16px', textAlign: 'right' }}>
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} total
          </p>

          {submissions.map((s, idx) => (
            <motion.div
              key={s.submission_id}
              className="card"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 className="card-title">{s.title}</h3>
                  <p className="card-meta">
                    <strong>Student:</strong> {s.student_name} ({s.student_email})
                  </p>
                </div>
                <span className={`chip chip-${s.status}`}>
                  {s.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                </span>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span className="card-meta">
                  Assigned: {s.assigned_count || 0}
                </span>
                <span className="card-meta">
                  Completed: {s.completed_count || 0}
                </span>
                <span className="card-muted">
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </div>

              {s.file_url && (
                <a
                  href={s.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ marginTop: '12px', fontSize: '0.85rem', padding: '6px 14px' }}
                >
                  Download File
                </a>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
