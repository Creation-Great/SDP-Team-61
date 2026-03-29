import { FileText, Download } from 'lucide-react';

export default function PdfViewer({ url, className = '' }) {
  if (!url) {
    return (
      <div className={`flex flex-col items-center justify-center p-12 bg-slate-50 rounded-xl border border-slate-200 ${className}`}>
        <FileText size={48} className="text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">No PDF to display</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-xl border border-slate-200 overflow-hidden ${className}`}>
      <iframe
        src={url}
        title="PDF Viewer"
        className="w-full flex-1 min-h-[600px]"
        style={{ border: 'none' }}
      />
      <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">
          If the PDF does not display, use the download link.
        </span>
        <a
          href={url}
          download
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Download size={14} />
          Download PDF
        </a>
      </div>
    </div>
  );
}
