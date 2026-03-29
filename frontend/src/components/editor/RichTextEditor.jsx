import { useState, useCallback } from 'react';
import { Bold, Italic, List, Code } from 'lucide-react';
import Button from '../ui/Button';

export default function RichTextEditor({ value, onChange, placeholder = 'Write your review...' }) {
  const [text, setText] = useState(value || '');

  const handleChange = useCallback((e) => {
    setText(e.target.value);
    onChange?.(e.target.value);
  }, [onChange]);

  const insertMarkdown = (prefix, suffix = '') => {
    const textarea = document.getElementById('rich-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
    setText(newText);
    onChange?.(newText);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        <Button variant="ghost" size="sm" onClick={() => insertMarkdown('**', '**')} aria-label="Bold"><Bold size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => insertMarkdown('*', '*')} aria-label="Italic"><Italic size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => insertMarkdown('\n- ')} aria-label="List"><List size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => insertMarkdown('`', '`')} aria-label="Code"><Code size={16} /></Button>
      </div>
      <textarea
        id="rich-editor"
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full min-h-[200px] p-4 text-sm resize-y focus:outline-none"
      />
    </div>
  );
}
