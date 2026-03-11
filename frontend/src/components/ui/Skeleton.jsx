/**
 * Skeleton loading placeholder with shimmer animation.
 * Variants: text | card | row
 */
export default function Skeleton({ width, height, variant = 'text', className = '' }) {
  const baseStyles = {
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: '6px',
  };

  const variantStyles = {
    text: { width: width || '100%', height: height || '16px' },
    card: { width: width || '100%', height: height || '160px', borderRadius: '12px' },
    row: { width: width || '100%', height: height || '48px' },
  };

  return <div style={{ ...baseStyles, ...variantStyles[variant] }} className={className} />;
}
