import { useState, useEffect } from 'react';
import API from '../services/api';

export default function useCalendar() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/deadlines/calendar')
      .then(r => setDeadlines(r.data || []))
      .catch(() => setDeadlines([]))
      .finally(() => setLoading(false));
  }, []);

  return { deadlines, loading };
}
