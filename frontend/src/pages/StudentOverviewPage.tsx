import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  BarChart3,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import type { AssignedReview, ReceivedReview } from '../types';
import { apiFetch } from '../utils/api';
import { Skeleton } from '../components/Skeleton';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score < 2.5) return 'var(--danger)';
  if (score <= 3.5) return 'var(--uconn-orange)';
  return 'var(--success)';
}

function formatTimeLeft(closes_at: string): { label: string; urgent: boolean; critical: boolean } {
  const diff = new Date(closes_at).getTime() - Date.now();
  if (diff <= 0) return { label: 'Closing', urgent: true, critical: true };
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return { label: `${mins}m left`, urgent: true, critical: true };
  }
  if (hours < 24) return { label: `${Math.floor(hours)}h left`, urgent: true, critical: hours < 6 };
  const days = Math.floor(hours / 24);
  return { label: `${days}d left`, urgent: days < 2, critical: false };
}

function formatDeadlineDate(closes_at: string): string {
  return new Date(closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Placeholder feedback keywords (UI-only; NLP extraction added later)
const PLACEHOLDER_FEEDBACK = [
  { text: 'Strong communication', count: 3, positive: true },
  { text: 'Good teamwork', count: 2, positive: true },
  { text: 'Needs more collaboration', count: 2, positive: false },
  { text: 'Reliable & consistent', count: 1, positive: true },
];

export default function StudentOverviewPage() {
  const navigate = useNavigate();
  const [assigned, setAssigned] = useState<AssignedReview[]>([]);
  const [received, setReceived] = useState<ReceivedReview[]>([]);
  const [loading, setLoading] = useState(true);

  const user: { name?: string } = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  })();

  useEffect(() => {
    Promise.all([
      apiFetch<AssignedReview[]>('/me/assigned-reviews'),
      apiFetch<ReceivedReview[]>('/me/received-reviews'),
    ])
      .then(([a, r]) => { setAssigned(a); setReceived(r); })
      .finally(() => setLoading(false));
  }, []);

  const pendingReviews = useMemo(
    () => assigned
      .filter(r => r.status === 'PENDING' && r.week_is_open)
      .sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime()),
    [assigned],
  );

  const completedCount = useMemo(
    () => assigned.filter(r => r.status === 'SUBMITTED').length,
    [assigned],
  );

  const latestScore = useMemo(
    () => received.find(r => r.avg_overall !== null)?.avg_overall ?? null,
    [received],
  );

  const overallAvg = useMemo(() => {
    const valid = received.filter(r => r.avg_overall !== null);
    if (valid.length === 0) return null;
    return valid.reduce((s, r) => s + r.avg_overall!, 0) / valid.length;
  }, [received]);

  // Progress over time: received reviews sorted by week
  const progressData = useMemo(
    () => [...received]
      .filter(r => r.avg_overall !== null)
      .sort((a, b) => a.week_number - b.week_number),
    [received],
  );

  // Trend: compare last two scores
  const trend = useMemo(() => {
    if (progressData.length < 2) return 0;
    return progressData[progressData.length - 1].avg_overall! - progressData[progressData.length - 2].avg_overall!;
  }, [progressData]);

  // SVG line chart dimensions
  const SVG_W = 460;
  const SVG_H = 90;
  const PAD = { top: 10, right: 16, bottom: 24, left: 32 };
  const plotW = SVG_W - PAD.left - PAD.right;
  const plotH = SVG_H - PAD.top - PAD.bottom;

  const xScale = (i: number) =>
    PAD.left + (progressData.length > 1 ? (i / (progressData.length - 1)) * plotW : plotW / 2);
  const yScale = (v: number) =>
    PAD.top + plotH - ((v - 1) / 4) * plotH; // scores 1–5

  const linePath = progressData.length > 1
    ? progressData.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(r.avg_overall!).toFixed(1)}`).join(' ')
    : '';

  const areaPath = progressData.length > 1
    ? `${linePath} L ${xScale(progressData.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${xScale(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`
    : '';

  const gridLines = [1, 2, 3, 4, 5];

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = user.name?.split(' ')[0] ?? 'Student';

  const stats = [
    {
      label: 'Pending Reviews',
      value: pendingReviews.length,
      color: pendingReviews.length > 0 ? 'var(--uconn-orange)' : 'var(--text-muted)',
      icon: <ClipboardList width={20} height={20} />,
      sub: 'action needed',
      onClick: () => navigate('/student/reviews'),
    },
    {
      label: 'Completed',
      value: completedCount,
      color: 'var(--success)',
      icon: <CheckCircle width={20} height={20} />,
      sub: 'submitted',
      onClick: () => navigate('/student/reviews'),
    },
    {
      label: 'Latest Score',
      value: latestScore !== null ? latestScore.toFixed(1) : '—',
      color: scoreColor(latestScore),
      icon: <BarChart3 width={20} height={20} />,
      sub: 'most recent cycle',
      onClick: () => navigate('/student/history'),
    },
    {
      label: 'Avg Score',
      value: overallAvg !== null ? overallAvg.toFixed(1) : '—',
      color: scoreColor(overallAvg),
      icon: <TrendingUp width={20} height={20} />,
      sub: 'all time',
      onClick: () => navigate('/student/history'),
    },
  ];

  const perfMetrics = [
    {
      label: 'Avg Received',
      value: overallAvg !== null ? overallAvg.toFixed(1) : '—',
      color: scoreColor(overallAvg),
    },
    {
      label: 'Avg Given',
      value: '—',
      color: 'var(--text-muted)',
    },
    {
      label: 'Class Avg',
      value: '—',
      color: 'var(--text-muted)',
    },
    {
      label: 'Trend',
      value: trend > 0.1 ? '↑' : trend < -0.1 ? '↓' : '→',
      color: trend > 0.1 ? 'var(--success)' : trend < -0.1 ? 'var(--danger)' : 'var(--text-muted)',
      icon: trend > 0.1
        ? <TrendingUp width={13} height={13} />
        : trend < -0.1
          ? <TrendingDown width={13} height={13} />
          : <Minus width={13} height={13} />,
    },
  ];

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-hero-band">
        <div>
          <h1>
            {greeting()}, <span style={{ color: 'var(--uconn-orange)' }}>{firstName}</span>
          </h1>
          <p>
            {loading
              ? 'Loading your activity...'
              : pendingReviews.length > 0
                ? `You have ${pendingReviews.length} pending review${pendingReviews.length !== 1 ? 's' : ''} · ${dateStr}`
                : `All caught up — no pending reviews · ${dateStr}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} variant="row" height="82px" />)}
          </div>
          <Skeleton variant="row" height="56px" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Skeleton variant="card" height="300px" />
            <Skeleton variant="card" height="300px" />
          </div>
          <Skeleton variant="card" height="160px" />
        </div>
      ) : (
        <>
          {/* ── Stat cards ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                onClick={stat.onClick}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', borderLeft: `3px solid ${stat.color}`, padding: '22px 28px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                whileHover={{ y: -2, boxShadow: '0 6px 28px rgba(0,0,0,0.10)' } as any}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ color: stat.color, opacity: 0.85 }}>{stat.icon}</span>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {stat.label}
                  </span>
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '2.4rem', fontWeight: 700, color: stat.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stat.value}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {stat.sub}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── My Performance Snapshot ───────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.3 }}
            style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '14px 24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '0' }}
          >
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginRight: '28px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              My Performance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', flex: 1 }}>
              {perfMetrics.map((m, i) => (
                <div
                  key={m.label}
                  style={{
                    padding: '8px 20px',
                    borderLeft: i > 0 ? '1px solid var(--glass-border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.60rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                      {m.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {m.icon && <span style={{ color: m.color }}>{m.icon}</span>}
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1.4rem', fontWeight: 700, color: m.color, lineHeight: 1 }}>
                        {m.value}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Content: Upcoming Deadlines | Recent Scores + Feedback ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            {/* Left: Upcoming Deadlines */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}
            >
              <div style={{ padding: '16px 24px', background: '#f8f9fb', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Upcoming Deadlines
                </span>
                {pendingReviews.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/student/reviews')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tech-blue)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    View All →
                  </button>
                )}
              </div>

              {pendingReviews.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <CheckCircle width={32} height={32} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
                  <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>
                    All caught up!
                  </p>
                  <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    No pending reviews at this time.
                  </p>
                </div>
              ) : (
                <div>
                  {pendingReviews.slice(0, 6).map((review) => {
                    const time = formatTimeLeft(review.closes_at);
                    return (
                      <div
                        key={review.assignment_id}
                        onClick={() => navigate(`/student/assignments/${review.assignment_id}`)}
                        style={{ padding: '16px 24px', borderBottom: '1px solid rgba(75,159,225,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', transition: 'background 0.14s ease' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(75,159,225,0.05)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {review.reviewee_name}
                          </div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.70rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {review.course_name} · Week {review.week_number}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.70rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: time.critical ? 'var(--danger)' : time.urgent ? 'var(--uconn-orange)' : 'var(--text-muted)' }}>
                            <Clock width={13} height={13} />
                            {time.label}
                          </div>
                          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            Due {formatDeadlineDate(review.closes_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Right: Recent Scores + Feedback Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden', flex: 1 }}
              >
                <div style={{ padding: '16px 24px', background: '#f8f9fb', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Recent Scores
                  </span>
                  {received.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/student/history')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tech-blue)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      View All →
                    </button>
                  )}
                </div>

                {received.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <BarChart3 width={32} height={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.4 }} />
                    <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>No scores yet</p>
                    <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scores appear here after review weeks close.</p>
                  </div>
                ) : (
                  <div>
                    {received.slice(0, 4).map((review) => {
                      const score = review.avg_overall;
                      const reviewCount = review.n_reviews ?? 0;
                      const cats = Object.entries(review.per_category_json ?? {});
                      return (
                        <div key={review.week_id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(75,159,225,0.07)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: cats.length > 0 ? '12px' : 0 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '0.90rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                                {review.course_name}
                              </div>
                              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                                Week {review.week_number} · {reviewCount === 0 ? 'no reviews received' : `${reviewCount} review${reviewCount !== 1 ? 's' : ''}`}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1.7rem', fontWeight: 700, color: scoreColor(score), flexShrink: 0, lineHeight: 1 }}>
                              {score !== null ? score.toFixed(1) : '—'}
                            </div>
                          </div>
                          {cats.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                              {cats.slice(0, 3).map(([label, val]) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: 'var(--text-muted)', width: '96px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {label}
                                  </span>
                                  <div style={{ flex: 1, height: '7px', background: 'var(--surface-elevated)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, (val / 5) * 100)}%`, height: '100%', background: scoreColor(val), borderRadius: '4px' }} />
                                  </div>
                                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', color: scoreColor(val), fontWeight: 600, width: '28px', textAlign: 'right', flexShrink: 0 }}>
                                    {val.toFixed(1)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Feedback Summary Widget */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.46, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}
              >
                <div style={{ padding: '16px 24px', background: '#f8f9fb', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <MessageSquare width={13} height={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Feedback Themes
                  </span>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.58rem', color: 'var(--text-muted)', marginLeft: 'auto', opacity: 0.6 }}>
                    preview
                  </span>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {PLACEHOLDER_FEEDBACK.map(item => (
                    <div
                      key={item.text}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px',
                        background: item.positive ? 'rgba(61,187,121,0.08)' : 'rgba(232,119,34,0.08)',
                        border: `1px solid ${item.positive ? 'rgba(61,187,121,0.25)' : 'rgba(232,119,34,0.25)'}`,
                        borderRadius: '12px',
                      }}
                    >
                      {item.positive
                        ? <ThumbsUp width={12} height={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        : <ThumbsDown width={12} height={12} style={{ color: 'var(--uconn-orange)', flexShrink: 0 }} />}
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.68rem', color: item.positive ? 'var(--success)' : 'var(--uconn-orange)' }}>
                        {item.text}
                      </span>
                      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--text-muted)', marginLeft: '2px' }}>
                        ({item.count})
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── Progress Over Time ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            style={{ background: 'var(--surface-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px 28px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'var(--uconn-orange)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
                  Score History
                </div>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Progress Over Time
                </h2>
              </div>
              {progressData.length >= 2 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: trend > 0.1 ? 'rgba(61,187,121,0.1)' : trend < -0.1 ? 'rgba(220,38,38,0.08)' : 'rgba(75,159,225,0.08)', border: `1px solid ${trend > 0.1 ? 'rgba(61,187,121,0.3)' : trend < -0.1 ? 'rgba(220,38,38,0.2)' : 'var(--glass-border)'}`, borderRadius: '4px' }}>
                  {trend > 0.1
                    ? <TrendingUp width={12} height={12} style={{ color: 'var(--success)' }} />
                    : trend < -0.1
                      ? <TrendingDown width={12} height={12} style={{ color: 'var(--danger)' }} />
                      : <Minus width={12} height={12} style={{ color: 'var(--text-muted)' }} />}
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.64rem', fontWeight: 600, color: trend > 0.1 ? 'var(--success)' : trend < -0.1 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {trend > 0.1 ? `+${trend.toFixed(1)}` : trend < -0.1 ? trend.toFixed(1) : 'Stable'}
                  </span>
                </div>
              )}
            </div>

            {progressData.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center' }}>
                <BarChart3 width={28} height={28} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.35 }} />
                <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Score history will appear here after review cycles complete.
                </p>
              </div>
            ) : progressData.length === 1 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Week {progressData[0].week_number}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '2rem', fontWeight: 700, color: scoreColor(progressData[0].avg_overall) }}>
                  {progressData[0].avg_overall?.toFixed(1)}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                  Complete more review cycles to see your progress trend.
                </div>
              </div>
            ) : (
              <div>
                <svg
                  width="100%"
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  style={{ display: 'block', overflow: 'visible' }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--tech-blue)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--tech-blue)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Gridlines */}
                  {gridLines.map(v => (
                    <g key={v}>
                      <line
                        x1={PAD.left} y1={yScale(v).toFixed(1)}
                        x2={SVG_W - PAD.right} y2={yScale(v).toFixed(1)}
                        stroke="rgba(75,159,225,0.1)" strokeWidth="1"
                      />
                      <text
                        x={PAD.left - 6} y={yScale(v) + 4}
                        textAnchor="end"
                        style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '9px', fill: 'var(--text-muted)' }}
                      >
                        {v}
                      </text>
                    </g>
                  ))}

                  {/* Area fill */}
                  <path d={areaPath} fill="url(#areaGrad)" />

                  {/* Line */}
                  <path d={linePath} fill="none" stroke="var(--tech-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Data points + labels */}
                  {progressData.map((r, i) => (
                    <g key={r.week_id}>
                      <circle
                        cx={xScale(i).toFixed(1)}
                        cy={yScale(r.avg_overall!).toFixed(1)}
                        r="4"
                        fill="var(--surface-card)"
                        stroke={scoreColor(r.avg_overall)}
                        strokeWidth="2"
                      />
                      <text
                        x={xScale(i).toFixed(1)}
                        y={SVG_H - 4}
                        textAnchor="middle"
                        style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '9px', fill: 'var(--text-muted)' }}
                      >
                        W{r.week_number}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
