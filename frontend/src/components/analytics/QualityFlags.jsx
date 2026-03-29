import { Flag, ShieldAlert } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

/**
 * Displays file-review and peer-review quality flags side by side.
 *
 * Props:
 *  - flagsLoading  {boolean}
 *  - qualityFlags  {Array}  file-review flags
 *  - peerQualityFlags {Array} peer-review flags
 */
export default function QualityFlags({ flagsLoading, qualityFlags, peerQualityFlags }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* File Review Quality Flags */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <Flag className="w-5 h-5 mr-2 text-red-500" /> File Review Quality Flags
        </h3>
        {flagsLoading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : qualityFlags.length === 0 ? (
          <p className="text-sm text-slate-500">No file review quality issues detected.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {qualityFlags.map((f, i) => (
              <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900">{f.reviewer_name}</span>
                  <Badge type="error">{f.flag_reason}</Badge>
                </div>
                <p className="text-slate-600 text-xs">
                  Reviewed <span className="font-medium">{f.author_name}</span>'s "{f.submission_title}"
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Peer Review Quality Flags */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 text-orange-500" /> Peer Review Quality Flags
        </h3>
        {flagsLoading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : peerQualityFlags.length === 0 ? (
          <p className="text-sm text-slate-500">No peer review quality issues detected.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {peerQualityFlags.map((f, i) => (
              <div key={i} className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900">{f.reviewer_name}</span>
                  <Badge type="warning">{f.flag_reason}</Badge>
                </div>
                <p className="text-slate-600 text-xs">
                  Reviewed <span className="font-medium">{f.reviewee_name}</span> in "{f.session_title}"
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
