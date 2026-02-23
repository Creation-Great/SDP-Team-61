import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import API from '../services/api';
import type { ReviewTask } from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';

export default function AssignedReviewsPage() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get<ReviewTask[]>('/submissions/reviews/my-tasks')
      .then(res => setTasks(res.data))
      .catch(err => { console.error('Failed to load review tasks:', err); setTasks([]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem' }}>
            Loading your review tasks...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Assigned Reviews" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Complete your pending peer review assignments.
        </p>
      </div>

      {tasks.length === 0 ? (
        <motion.div
          className="card empty-state"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Clock size={40} style={{ opacity: 0.3, marginBottom: '12px', color: 'var(--tech-blue)' }} />
          <h3>No pending reviews</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            You're all caught up! Check back later for new review assignments.
          </p>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tasks.map((task, idx) => (
            <motion.div
              key={task.assignment_id}
              className="card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.008, y: -1 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h3 className="card-title" style={{ marginBottom: '6px' }}>{task.title}</h3>
                  <p className="card-meta" style={{ marginBottom: '4px' }}>
                    <span style={{ color: 'var(--tech-blue)', fontWeight: 600 }}>From:</span>{' '}
                    {task.student_name}
                  </p>
                  <p className="card-muted" style={{ fontSize: '0.78rem' }}>
                    Assigned: {new Date(task.assigned_at).toLocaleString()}
                  </p>
                </div>
                <button
                  className="btn btn-cta btn-sm"
                  style={{ marginLeft: '16px', flexShrink: 0 }}
                  onClick={() => navigate(`/review/${task.assignment_id}`)}
                >
                  Start Review
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
