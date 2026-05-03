import { useState } from 'react';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import PdfViewer from './PdfViewer';
import Button from '../ui/Button';

export default function InlinePdfAnnotator({ pdfUrl, annotations = [], onAnnotate }) {
  const [newNote, setNewNote] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(null);

  const handleAddAnnotation = () => {
    if (!newNote.trim()) return;
    onAnnotate?.({
      text: newNote.trim(),
      position: selectedPosition || { page: 1, y: 0 },
      createdAt: new Date().toISOString(),
    });
    setNewNote('');
    setSelectedPosition(null);
  };

  return (
    <div className="flex gap-4 h-full">
      {/* PDF Panel */}
      <div className="flex-1 min-w-0">
        <PdfViewer url={pdfUrl} className="h-full" />
      </div>

      {/* Annotation Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <MessageSquarePlus size={16} />
            Annotations ({annotations.length})
          </h4>
        </div>

        {/* Annotation list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {annotations.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No annotations yet</p>
          )}
          {annotations.map((ann, idx) => (
            <div key={idx} className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <p className="text-slate-700">{ann.text}</p>
              {ann.position && (
                <p className="text-xs text-slate-400 mt-1">
                  Page {ann.position.page}, Position {Math.round(ann.position.y)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* New annotation input */}
        <div className="p-3 border-t border-slate-200 space-y-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add an annotation..."
            className="w-full p-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <Button size="sm" onClick={handleAddAnnotation} disabled={!newNote.trim()} className="w-full">
            Add Annotation
          </Button>
        </div>
      </div>
    </div>
  );
}
