import { useState, useRef, useEffect } from 'react';
import API from '../services/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot, User, MessageSquare } from 'lucide-react';

const CONTEXT_TYPES = [
  { value: 'writing_review', label: 'Writing Review' },
  { value: 'reading_review', label: 'Reading Review' },
  { value: 'teacher_summary', label: 'Teacher Summary' },
];

export default function AiChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [contextType, setContextType] = useState('writing_review');
  const [conversationId, setConversationId] = useState(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Abort any in-flight chat request when the page unmounts so the setState
  // calls below don't fire on an unmounted component
  useEffect(() => () => abortRef.current?.abort(), []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setSending(true);

    // Cancel any previous in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await API.post('/api/ai/chat', {
        message: text,
        context_type: contextType,
        conversation_id: conversationId,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.data.conversation_id) setConversationId(res.data.conversation_id);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      if (err?.name === 'CanceledError' || controller.signal.aborted) return;
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageSquare size={24} className="text-[#000E2F]" />
          <h1 className="text-2xl font-bold text-[#000E2F]">AI Assistant</h1>
        </div>
        <select
          value={contextType}
          onChange={e => setContextType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]"
        >
          {CONTEXT_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
      </div>

      <Card className="flex-1 overflow-y-auto p-4 space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Bot size={48} className="mb-3" />
            <p className="text-lg font-medium">How can I help you today?</p>
            <p className="text-sm">Ask about submissions, reviews, or course material.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-2 max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' ? 'bg-[#000E2F] text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#000E2F] text-white rounded-tr-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"><Bot size={14} className="text-slate-600" /></div>
              <div className="bg-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-sm">
                <span className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </Card>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000E2F]"
          disabled={sending}
        />
        <Button type="submit" disabled={!input.trim() || sending}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
