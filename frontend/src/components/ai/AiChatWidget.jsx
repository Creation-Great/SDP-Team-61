import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import API from '../../services/api';

export default function AiChatWidget({ contextType, contextId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await API.post('/api/ai/chat', {
        message: text,
        context_type: contextType,
        context_id: contextId,
        conversation_id: conversationId,
      });

      setConversationId(res.data.conversation_id);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#000E2F] text-white rounded-full shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        aria-label="Open AI chat"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#000E2F] text-white">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <span className="font-semibold text-sm">AI Assistant</span>
        </div>
        <button onClick={() => setOpen(false)} className="hover:bg-white/10 rounded p-1 transition-colors" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center mt-8">Ask me anything about this {contextType || 'item'}.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-slate-600" />
              </span>
            )}
            <div
              className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-[#000E2F] text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-700 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-blue-600" />
              </span>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-slate-600" />
            </span>
            <div className="bg-slate-100 rounded-xl px-4 py-2 text-sm text-slate-400">Thinking...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2 bg-[#000E2F] text-white rounded-lg hover:bg-[#001a4d] disabled:opacity-50 transition-colors"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
