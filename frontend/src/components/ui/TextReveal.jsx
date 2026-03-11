import { useState } from 'react';

/**
 * Character-by-character staggered text reveal animation.
 * Used for page titles and hero headings.
 */
export default function TextReveal({ word = 'Animations', className = '' }) {
  const [reset] = useState(0);
  return (
    <div key={reset} style={{ display: 'inline-block' }}>
      <span
        className={className}
        style={{
          display: 'inline-block',
          overflow: 'hidden',
          lineHeight: 1.15,
        }}
      >
        {word.split('').map((char, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: 0,
              animation: 'trReveal 0.5s ease-in-out forwards',
              animationDelay: `calc(0.025s * ${i})`,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </span>
      <style>{`
        @keyframes trReveal {
          0%   { transform: translateY(60%); opacity: 0; }
          100% { transform: translateY(0%);  opacity: 1; }
        }
      `}</style>
    </div>
  );
}
