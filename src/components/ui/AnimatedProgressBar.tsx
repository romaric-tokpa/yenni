"use client";

import { motion } from "framer-motion";

interface AnimatedProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  gradient?: string;
  duration?: number;
}

export default function AnimatedProgressBar({
  value,
  max = 100,
  className = "",
  barClassName = "",
  gradient,
  duration = 0.8,
}: AnimatedProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className={`h-1.5 lg:h-2 bg-white/5 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className={`h-full rounded-full ${barClassName}`}
        style={{
          width: `${pct}%`,
          background: gradient || "linear-gradient(90deg, #10b981, #34d399)",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{
          duration,
          ease: [0.4, 0, 0.2, 1],
        }}
      />
    </div>
  );
}
