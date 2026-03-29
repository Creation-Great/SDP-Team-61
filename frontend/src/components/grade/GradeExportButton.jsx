import Button from '../ui/Button';
import { Download } from 'lucide-react';
import API from '../../services/api';

export default function GradeExportButton({ courseId }) {
  const handleExport = async () => {
    try {
      const res = await API.get(`/grades/export/${courseId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `grades-${courseId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* toast error */ }
  };

  return (
    <Button variant="secondary" onClick={handleExport}>
      <Download size={16} className="mr-1" /> Export CSV
    </Button>
  );
}
