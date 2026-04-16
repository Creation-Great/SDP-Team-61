import { useState, useEffect, useCallback, useRef } from 'react';
import API from '../services/api';

export default function useGradeWeights(courseId) {
  const [weights, setWeights] = useState(null);
  const [loading, setLoading] = useState(true);
  const courseIdRef = useRef(courseId);

  useEffect(() => {
    courseIdRef.current = courseId;
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    API.get(`/grades/weights/${courseId}`)
      .then(r => setWeights(r.data))
      .catch(() => setWeights({
        file_review_weight: 40, peer_review_weight: 40, checkin_weight: 20,
        drop_lowest: 0, drop_highest: 0,
      }))
      .finally(() => setLoading(false));
  }, [courseId]);

  const save = useCallback(async (newWeights) => {
    await API.put(`/grades/weights/${courseIdRef.current}`, newWeights);
    setWeights(newWeights);
  }, []);

  return { weights, loading, save, setWeights };
}
