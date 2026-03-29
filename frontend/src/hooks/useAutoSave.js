import { useRef, useEffect, useCallback, useState } from 'react';

export default function useAutoSave({ data, saveFn, intervalMs = 30000, enabled = true }) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [version, setVersion] = useState(1);
  const dirtyRef = useRef(false);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
    dirtyRef.current = true;
  }, [data]);

  const save = useCallback(async () => {
    if (!dirtyRef.current || !enabled) return;
    setSaving(true);
    try {
      await saveFn(dataRef.current, version);
      dirtyRef.current = false;
      setLastSaved(new Date());
      setVersion(v => v + 1);
    } catch (err) {
      if (err?.response?.status === 409) {
        console.warn('Draft version conflict');
      }
    } finally {
      setSaving(false);
    }
  }, [saveFn, version, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(save, intervalMs);
    return () => clearInterval(id);
  }, [save, intervalMs, enabled]);

  return { saving, lastSaved, version, save };
}
