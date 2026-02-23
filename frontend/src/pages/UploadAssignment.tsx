import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import API from '../services/api';
import { TextReveal } from '../components/ui/text-reveal-animation';

export default function UploadAssignment() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!file) { setError('Please select a file to upload.'); return; }
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await API.post<{ message?: string }>('/submissions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(res.data.message ?? 'Upload successful!');
      setTitle('');
      setDescription('');
      setFile(null);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 className="page-title-reveal">
          <TextReveal word="Upload Assignment" />
        </h1>
        <div className="page-title-accent" />
        <p className="page-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
          Submit your work for peer review. A reviewer will be assigned automatically.
        </p>
      </div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ maxWidth: '640px' }}
      >
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Title</label>
            <input
              id="title"
              className="form-input"
              type="text"
              placeholder="Assignment title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              className="form-textarea"
              placeholder="Brief description of your assignment..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">File</label>
            <motion.div
              className={`drop-zone${isDragging ? ' active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              animate={{ scale: isDragging ? 1.02 : 1 }}
              transition={{ duration: 0.15 }}
            >
              {file ? (
                <div>
                  <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '4px' }}>
                    ✓ {file.name}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {(file.size / 1024).toFixed(1)} KB — click to change
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}>📁</div>
                  <p style={{ fontWeight: 500, marginBottom: '4px' }}>
                    Drag &amp; drop your file here, or click to browse
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    PDF, DOC, DOCX, TXT (max 10MB)
                  </p>
                </>
              )}
            </motion.div>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {message && (
            <motion.p
              className="success-text"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              ✓ {message}
            </motion.p>
          )}

          <button type="submit" className="btn btn-cta btn-block" disabled={loading}>
            {loading ? 'Uploading...' : 'Submit Assignment'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
