import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import API from '../services/api';
import type { Submission } from '../types';
import { TextReveal } from '../components/ui/text-reveal-animation';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/animated-table';

export default function InstructorDashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get<Submission[]>('/submissions/all')
      .then(res => setSubmissions(res.data))
      .catch(err => console.error('Error loading submissions:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.85rem' }}>
            Loading submissions...
          </p>
        </motion.div>
      </div>
    );
  }

  const reviewed = submissions.filter(s => s.status === 'reviewed').length;
  const pending = submissions.length - reviewed;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Instructor Dashboard" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Monitor all student submissions and review progress.
        </p>
      </div>

      {submissions.length === 0 ? (
        <motion.div
          className="card empty-state"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.4 }}>📋</div>
          <h3>No submissions yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Student submissions will appear here once uploaded.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Stats */}
          <motion.div
            className="stats-strip"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{submissions.length}</div>
              <div className="stat-sub">submissions</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Reviewed</div>
              <div className="stat-value" style={{ color: 'var(--success)', textShadow: '0 0 16px rgba(61,187,121,0.4)' }}>
                {reviewed}
              </div>
              <div className="stat-sub">completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending</div>
              <div className="stat-value" style={{ color: 'var(--uconn-orange)', textShadow: '0 0 16px rgba(232,119,34,0.4)' }}>
                {pending}
              </div>
              <div className="stat-sub">awaiting</div>
            </div>
          </motion.div>

          {/* Animated submissions table */}
          <motion.div
            className="card"
            style={{ padding: 0, overflow: 'hidden' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s, idx) => (
                  <motion.tr
                    key={s.submission_id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + idx * 0.04, duration: 0.35 }}
                    style={{ borderBottom: '1px solid var(--glass-border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(75,159,225,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <TableCell>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {s.student_name}
                      </div>
                      <div className="card-muted" style={{ fontSize: '0.75rem' }}>{s.student_email}</div>
                    </TableCell>
                    <TableCell style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {s.title}
                    </TableCell>
                    <TableCell>
                      <span className={`chip chip-${s.status}`}>
                        {s.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                      </span>
                    </TableCell>
                    <TableCell className="card-meta">{s.assigned_count ?? 0}</TableCell>
                    <TableCell className="card-meta">{s.completed_count ?? 0}</TableCell>
                    <TableCell className="card-muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {s.file_url && (
                        <a href={s.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                          Download
                        </a>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </>
      )}
    </div>
  );
}
