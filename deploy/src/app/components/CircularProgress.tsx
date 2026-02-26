import React from 'react';
import { motion } from 'motion/react';

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  earned: string;
  target: string;
}

export function CircularProgress({ progress, size = 150, strokeWidth = 10, earned, target }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  const getColor = () => {
    if (progress >= 100) return '#5C9A6F';
    if (progress >= 75) return '#D97757';
    if (progress >= 50) return '#D4A853';
    return '#D97757';
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F0EBE3"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {[25, 50, 75, 100].map(m => {
          const angle = (m / 100) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const dotX = size / 2 + radius * Math.cos(rad);
          const dotY = size / 2 + radius * Math.sin(rad);
          const reached = progress >= m;
          return (
            <circle
              key={m}
              cx={dotX}
              cy={dotY}
              r={3.5}
              fill={reached ? getColor() : '#E8E2D9'}
              stroke="white"
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[#1A1816]" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {Math.round(progress)}%
        </p>
        <p className="text-[#8B8579] mt-1" style={{ fontSize: 12 }}>{earned}</p>
        <p className="text-[#ADA79F]" style={{ fontSize: 11 }}>of {target}</p>
      </div>
    </div>
  );
}