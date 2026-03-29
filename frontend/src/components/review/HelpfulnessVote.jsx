import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import API from '../../services/api';

export default function HelpfulnessVote({ reviewId, initialVote = null, helpfulCount = 0, unhelpfulCount = 0 }) {
  const [vote, setVote] = useState(initialVote);
  const [counts, setCounts] = useState({ helpful: helpfulCount, unhelpful: unhelpfulCount });
  const [loading, setLoading] = useState(false);

  const handleVote = async (type) => {
    if (loading) return;
    setLoading(true);

    const newVote = vote === type ? null : type;

    try {
      await API.post('/quality/helpfulness', { review_id: reviewId, is_helpful: newVote === 'helpful' ? true : newVote === 'unhelpful' ? false : null });

      setCounts(prev => {
        const next = { ...prev };
        // Remove previous vote
        if (vote === 'helpful') next.helpful = Math.max(0, next.helpful - 1);
        if (vote === 'unhelpful') next.unhelpful = Math.max(0, next.unhelpful - 1);
        // Add new vote
        if (newVote === 'helpful') next.helpful++;
        if (newVote === 'unhelpful') next.unhelpful++;
        return next;
      });

      setVote(newVote);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400">Helpful?</span>
      <button
        onClick={() => handleVote('helpful')}
        disabled={loading}
        className={`
          flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors
          ${vote === 'helpful' ? 'bg-green-100 text-green-700' : 'hover:bg-slate-100 text-slate-500'}
        `}
        aria-label="Mark as helpful"
      >
        <ThumbsUp size={14} />
        <span className="tabular-nums transition-all">{counts.helpful}</span>
      </button>
      <button
        onClick={() => handleVote('unhelpful')}
        disabled={loading}
        className={`
          flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors
          ${vote === 'unhelpful' ? 'bg-red-100 text-red-700' : 'hover:bg-slate-100 text-slate-500'}
        `}
        aria-label="Mark as unhelpful"
      >
        <ThumbsDown size={14} />
        <span className="tabular-nums transition-all">{counts.unhelpful}</span>
      </button>
    </div>
  );
}
