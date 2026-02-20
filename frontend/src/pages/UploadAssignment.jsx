import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileUp, CheckCircle, AlertCircle } from 'lucide-react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function UploadAssignment() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await API.post('/submissions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(res.data.message || 'Upload successful!');
      setTitle('');
      setDescription('');
      setFile(null);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm ' +
    'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 ' +
    'focus:border-indigo-300 transition-all';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upload Assignment</h1>
          <p className="text-slate-500 mt-1">Submit your project deliverables for this week</p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        {/* Title & Description */}
        <Card className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="title">Title</label>
            <input
              id="title"
              className={inputClass}
              type="text"
              placeholder="Assignment title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              className={inputClass + ' min-h-[100px] resize-y'}
              placeholder="Brief description of your assignment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </Card>

        {/* Drag & Drop Zone (prototype style) */}
        <Card
          className={`p-8 border-dashed border-2 flex flex-col items-center justify-center min-h-[300px] transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : file
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-slate-300 bg-slate-50'
          }`}
          onClick={() => document.getElementById('file-input').click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{file.name}</h3>
              <p className="text-slate-500 text-sm">({(file.size / 1024).toFixed(1)} KB) — Click to change</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                <FileUp className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Drag & Drop files here</h3>
              <p className="text-slate-500 text-sm mb-6">Supported formats: PDF, ZIP, TXT. Max size: 50MB</p>
              <Button type="button" icon={Upload}>Browse Files</Button>
            </>
          )}
        </Card>
        <input
          id="file-input"
          type="file"
          accept=".pdf,.doc,.docx,.txt,.zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
        />

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert" aria-live="assertive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {message && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {message}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          <Upload className="w-4 h-4 mr-2" />
          {loading ? 'Uploading...' : 'Submit Assignment'}
        </Button>
      </form>
    </div>
  );
}
