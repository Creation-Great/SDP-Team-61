import { useState } from 'react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import { Download, Trash2, AlertTriangle, FileJson, Shield } from 'lucide-react';

export default function DataExportPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await API.get(`/compliance/export/${user?.id}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${user?.id}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported successfully', 'success');
    } catch {
      showToast('Failed to export data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    try {
      await API.post('/compliance/deletion-request', { user_id: user?.id });
      setDeleteRequested(true);
      setShowDeleteConfirm(false);
      setConfirmText('');
      setDeletionStatus('pending');
      showToast('Deletion request submitted', 'success');
    } catch {
      showToast('Failed to submit deletion request', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={24} className="text-[#000E2F]" />
        <h1 className="text-2xl font-bold text-[#000E2F]">Data & Privacy</h1>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileJson size={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Export My Data</h2>
            <p className="text-sm text-slate-500 mt-1">
              Download a copy of all your personal data in JSON format. This includes your profile, submissions, reviews, and activity history.
            </p>
            <Button className="mt-4" onClick={exportData} disabled={exporting}>
              <Download size={16} className="mr-2" /> {exporting ? 'Exporting...' : 'Export My Data'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-red-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">Request Account Deletion</h2>
            <p className="text-sm text-slate-500 mt-1">
              Request permanent deletion of your account and all associated data. This action cannot be undone.
            </p>

            {deletionStatus === 'pending' && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm text-amber-800">A deletion request is pending review.</span>
                <Badge type="warning">Pending</Badge>
              </div>
            )}

            {!deleteRequested && !showDeleteConfirm && (
              <Button className="mt-4" variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} className="mr-2" /> Request Deletion
              </Button>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg space-y-3">
                <p className="text-sm font-medium text-red-900">
                  Are you sure? This will permanently delete all your data.
                </p>
                <div>
                  <label className="text-sm text-red-700 block mb-1">Type "DELETE" to confirm:</label>
                  <input
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={requestDeletion}
                    disabled={confirmText !== 'DELETE'}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Confirm Deletion
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setConfirmText(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
