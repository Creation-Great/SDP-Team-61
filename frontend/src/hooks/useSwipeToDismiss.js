import { useRef, useCallback } from 'react';

export default function useSwipeToDismiss(onDismiss, threshold = 100) {
  const startX = useRef(0);
  const currentX = useRef(0);
  const elementRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
  }, []);

  const onTouchMove = useCallback((e) => {
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    if (elementRef.current && diff > 0) {
      elementRef.current.style.transform = `translateX(-${Math.min(diff, threshold * 1.5)}px)`;
      elementRef.current.style.opacity = `${1 - diff / (threshold * 2)}`;
    }
  }, [threshold]);

  const onTouchEnd = useCallback(() => {
    const diff = startX.current - currentX.current;
    if (diff > threshold) {
      onDismiss?.();
    }
    if (elementRef.current) {
      elementRef.current.style.transform = '';
      elementRef.current.style.opacity = '';
    }
  }, [onDismiss, threshold]);

  return { elementRef, onTouchStart, onTouchMove, onTouchEnd };
}
