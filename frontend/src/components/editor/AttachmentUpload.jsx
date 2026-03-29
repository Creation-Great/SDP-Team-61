import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle } from 'lucide-react';
import Button from '../ui/Button';

export default function AttachmentUpload({ onUpload, accept = '*', maxSize = 10 * 1024 * 1024 }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const validateFile = (f) => {
    if (f.size > maxSize) {
      setError(`File exceeds maximum size of ${Math.round(maxSize / (1024 * 1024))}MB`);
      return false;
    }
    setError('');
    return true;
  };

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (validateFile(f)) {
      setFile(f);
      setProgress(0);
    }
  }, [maxSize]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = (e) => {
    handleFile(e.target.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file || !onUpload) return;
    setUploading(true);
    setProgress(0);
    try {
      await onUpload(file, (pct) => setProgress(pct));
      setProgress(100);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setProgress(0);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}
        `}
      >
        <Upload size={32} className={`mb-2 ${dragOver ? 'text-blue-500' : 'text-slate-400'}`} />
        <p className="text-sm font-medium text-slate-600">
          Drop a file here or <span className="text-blue-600">browse</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Max {Math.round(maxSize / (1024 * 1024))}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* File preview */}
      {file && (
        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
          <FileText size={20} className="text-slate-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            {uploading && (
              <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {progress === 100 && !uploading && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                <CheckCircle size={12} /> Uploaded
              </span>
            )}
          </div>
          <button onClick={handleRemove} className="p-1 hover:bg-slate-100 rounded" aria-label="Remove file">
            <X size={16} className="text-slate-400" />
          </button>
        </div>
      )}

      {/* Upload button */}
      {file && progress < 100 && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      )}
    </div>
  );
}
