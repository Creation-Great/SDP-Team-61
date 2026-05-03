import { memo } from 'react';

/**
 * Reusable Card component — white rounded-2xl shadow-sm with border.
 */
export default memo(function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border border-slate-200 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    >
      {children}
    </div>
  );
});
