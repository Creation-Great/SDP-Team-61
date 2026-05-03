import React, { useRef, useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
} from 'framer-motion';

/** Lightweight background-only version for layout use */
export default function InfiniteGridBackground() {
  const containerRef = useRef(null);
  const mouseX = useMotionValue(9999);
  const mouseY = useMotionValue(9999);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const { left, top } = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - left);
      mouseY.set(e.clientY - top);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.3) % 40);
    gridOffsetY.set((gridOffsetY.get() + 0.3) % 40);
  });

  const maskImage = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {/* Static faint grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.07 }}>
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </div>
      {/* Mouse-reveal grid */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>
      <AmbientGlow />
    </div>
  );
}

function AmbientGlow() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: '-15%',
          top: '-15%',
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: 'rgba(0, 14, 47, 0.06)',
          filter: 'blur(140px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          bottom: '-15%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: 'rgba(59, 125, 216, 0.05)',
          filter: 'blur(140px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '30%',
          top: '40%',
          width: '20%',
          height: '20%',
          borderRadius: '50%',
          background: 'rgba(59, 125, 216, 0.04)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

function GridPattern({ offsetX, offsetY }) {
  return (
    <svg style={{ width: '100%', height: '100%' }}>
      <defs>
        <motion.pattern
          id="infinite-grid-pattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="0.6"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#infinite-grid-pattern)" />
    </svg>
  );
}
