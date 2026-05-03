import { Sparkles } from 'lucide-react';
import Card from '../ui/Card';

/**
 * Standalone AI Activity Logs panel. Displays recent AI actions
 * (feedback, rewrite, summarize, etc.) with relative timestamps.
 */
export default function AiLogsPanel({ aiLogs, aiLogsLoading }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">Recent AI Activity Logs</h2>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {aiLogsLoading && (
            <p className="text-sm text-slate-400 text-center py-4">Loading AI logs...</p>
          )}
          {!aiLogsLoading && aiLogs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No AI activity recorded yet.</p>
          )}
          {!aiLogsLoading && aiLogs.map((log) => {
            const mins = Math.floor((Date.now() - new Date(log.created_at).getTime()) / 60000);
            let timeStr;
            if (mins < 1) timeStr = 'just now';
            else if (mins < 60) timeStr = `${mins}m ago`;
            else if (mins < 1440) timeStr = `${Math.floor(mins / 60)}h ago`;
            else timeStr = `${Math.floor(mins / 1440)}d ago`;

            return (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-900">
                    <span className="font-medium">{log.user_name || log.user_id || 'A user'}</span>{' '}
                    used AI <span className="capitalize font-medium">{log.action}</span>
                    {log.detail?.input_length ? ` (${log.detail.input_length} ${log.action === 'summarize' ? 'reviews' : 'chars'})` : ''}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{timeStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
