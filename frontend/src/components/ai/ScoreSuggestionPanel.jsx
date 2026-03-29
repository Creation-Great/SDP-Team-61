import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import API from '../../services/api';

export default function ScoreSuggestionPanel({ submissionId, onSuggest }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState('');

  const handleGetSuggestion = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/api/ai/score-suggestion', { submission_id: submissionId });
      setSuggestion(res.data);
      onSuggest?.(res.data);
    } catch {
      setError('Failed to get AI suggestion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          <span className="text-sm font-semibold text-slate-700">AI Score Suggestion</span>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
          {!suggestion && (
            <div className="pt-3">
              <Button onClick={handleGetSuggestion} disabled={loading} className="w-full">
                {loading ? 'Analyzing...' : 'Get AI Score Suggestion'}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {suggestion && (
            <div className="pt-3 space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Suggested Range</p>
                  <p className="text-2xl font-bold text-[#000E2F]">
                    {suggestion.suggested_min} &mdash; {suggestion.suggested_max}
                  </p>
                </div>
                {suggestion.confidence && (
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">Confidence</p>
                    <p className="text-lg font-semibold text-slate-700">{Math.round(suggestion.confidence * 100)}%</p>
                  </div>
                )}
              </div>

              {suggestion.reasoning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 mb-1">Reasoning</p>
                  <p className="text-sm text-amber-900">{suggestion.reasoning}</p>
                </div>
              )}

              <Button variant="secondary" size="sm" onClick={handleGetSuggestion} disabled={loading}>
                {loading ? 'Re-analyzing...' : 'Refresh Suggestion'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
