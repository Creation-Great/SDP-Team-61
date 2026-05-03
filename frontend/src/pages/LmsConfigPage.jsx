import { useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import { Link2, CheckCircle, Upload, Download, Zap } from 'lucide-react';

const PROVIDERS = [
  { value: 'none', label: 'None' },
  { value: 'canvas_mock', label: 'Canvas (Mock)' },
  { value: 'blackboard_mock', label: 'Blackboard (Mock)' },
  { value: 'moodle_mock', label: 'Moodle (Mock)' },
];

export default function LmsConfigPage() {
  const { showToast } = useToast();
  const [provider, setProvider] = useState('none');
  const [config, setConfig] = useState({ api_url: '', api_key: '' });
  const [result, setResult] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const mockAction = (action) => {
    setActionLoading(action);
    setResult(null);
    setTimeout(() => {
      const responses = {
        test: { success: true, message: `Connected to ${provider} successfully. Latency: 42ms.`, provider },
        import: { success: true, message: 'Imported 32 students from roster.', students_added: 32, students_updated: 5 },
        push: { success: true, message: 'Pushed grades for 28 students.', grades_pushed: 28, errors: 0 },
      };
      setResult(responses[action]);
      showToast(responses[action].message, 'success');
      setActionLoading('');
    }, 1200);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link2 size={24} className="text-[#000E2F]" />
        <h1 className="text-2xl font-bold text-[#000E2F]">LMS Integration</h1>
        {provider !== 'none' && <Badge type="success">Connected</Badge>}
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
          <select
            value={provider}
            onChange={e => { setProvider(e.target.value); setResult(null); }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]"
          >
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {provider !== 'none' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API URL</label>
              <input
                value={config.api_url}
                onChange={e => setConfig(prev => ({ ...prev, api_url: e.target.value }))}
                placeholder={`https://${provider.replace('_mock', '')}.example.com/api`}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
              <input
                type="password"
                value={config.api_key}
                onChange={e => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="Enter API key"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]"
              />
            </div>
          </>
        )}
      </Card>

      {provider !== 'none' && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => mockAction('test')} disabled={!!actionLoading}>
              <Zap size={16} className="mr-2" /> {actionLoading === 'test' ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="outline" onClick={() => mockAction('import')} disabled={!!actionLoading}>
              <Download size={16} className="mr-2" /> {actionLoading === 'import' ? 'Importing...' : 'Import Roster'}
            </Button>
            <Button variant="outline" onClick={() => mockAction('push')} disabled={!!actionLoading}>
              <Upload size={16} className="mr-2" /> {actionLoading === 'push' ? 'Pushing...' : 'Push Grades'}
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-6 bg-emerald-50 border-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-900">{result.message}</p>
              <div className="mt-2 text-sm text-emerald-700 space-y-0.5">
                {Object.entries(result).filter(([k]) => !['success', 'message'].includes(k)).map(([k, v]) => (
                  <p key={k}>{k.replace(/_/g, ' ')}: <span className="font-medium">{String(v)}</span></p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
