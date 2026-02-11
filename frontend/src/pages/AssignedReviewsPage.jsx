import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function AssignedReviewsPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/submissions/reviews/my-tasks')
      .then((res) => setTasks(res.data))
      .catch((err) => {
        console.error('Failed to load review tasks:', err);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading your review tasks...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Assigned Reviews</h1>
      <p className="page-subtitle">Complete your pending peer review assignments.</p>

      {tasks.length === 0 ? (
        <div className="card empty-state">
          <h3>No pending reviews</h3>
          <p>You're all caught up! Check back later for new review assignments.</p>
        </div>
      ) : (
        tasks.map((task, idx) => (
          <motion.div
            key={task.assignment_id}
            className="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            whileHover={{ scale: 1.01 }}
          >
            <h3 className="card-title">{task.title}</h3>
            <p className="card-meta">
              <strong>From:</strong> {task.student_name}
            </p>
            <p className="card-muted">
              Assigned: {new Date(task.assigned_at).toLocaleString()}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '14px', fontSize: '0.9rem', padding: '10px 20px' }}
              onClick={() => navigate(`/review/${task.assignment_id}`)}
            >
              Start Review
            </button>
          </motion.div>
        ))
      )}
    </div>
  );
}
