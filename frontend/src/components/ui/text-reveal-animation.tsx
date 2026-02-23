import { useState } from "react";

interface TextRevealProps {
  word?: string;
  className?: string;
}

export function TextReveal({ word, className }: TextRevealProps) {
  const [reset, setReset] = useState(0);
  const WORD = word || "Animations";
  return (
    <div key={reset} style={{ display: "inline-block" }}>
      <span
        className={className}
        style={{
          display: "inline-block",
          overflow: "hidden",
          lineHeight: 1.15,
        }}
      >
        {WORD.split("").map((char, i) => (
          <span
            key={i}
            style={
              {
                display: "inline-block",
                opacity: 0,
                animation: "trReveal 0.5s ease-in-out forwards",
                animationDelay: `calc(0.025s * ${i})`,
              } as React.CSSProperties
            }
          >
            {char === " " ? "\u00A0" : char}
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
