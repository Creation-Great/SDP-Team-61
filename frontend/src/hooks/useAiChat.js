import { useState, useCallback, useRef, useEffect } from 'react';
import API from '../services/api';

export default function useAiChat(contextType = 'writing_review', contextId = null) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const sendMessage = useCallback(async (text) => {
    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data } = await API.post('/api/ai/chat', {
        message: text,
        context_type: contextType,
        context_id: contextId,
        conversation_id: conversationId,
      }, { signal: controller.signal });
      setConversationId(data.conversation_id);
      const aiMsg = { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      if (err?.name === 'CanceledError') return;
      const errMsg = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString(), error: true };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [contextType, contextId, conversationId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
  }, []);

  return { messages, loading, sendMessage, reset, conversationId };
}
