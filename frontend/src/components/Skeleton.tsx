import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'card' | 'row';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, variant = 'text', className = '' }) => {
  const baseStyles: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-card) 25%, var(--surface-elevated) 50%, var(--surface-card) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: '3px',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    text: { width: width || '100%', height: height || '16px' },
    card: { width: width || '100%', height: height || '160px' },
    row: { width: width || '100%', height: height || '48px' },
  };

  return <div style={{ ...baseStyles, ...variantStyles[variant] }} className={className} />;
};
