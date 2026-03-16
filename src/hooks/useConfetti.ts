"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  const fire = useCallback((options?: { particleCount?: number; spread?: number; origin?: { x: number; y: number } }) => {
    const count = options?.particleCount ?? 120;
    const spread = options?.spread ?? 70;
    const origin = options?.origin ?? { x: 0.5, y: 0.6 };

    confetti({
      particleCount: count,
      spread,
      origin,
      colors: ["#10b981", "#059669", "#34d399", "#f59e0b", "#fbbf24", "#6366f1", "#8b5cf6"],
      ticks: 200,
      gravity: 0.8,
      scalar: 1.1,
    });

    setTimeout(() => {
      confetti({
        particleCount: Math.floor(count * 0.4),
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#10b981", "#f59e0b"],
      });
      confetti({
        particleCount: Math.floor(count * 0.4),
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#10b981", "#f59e0b"],
      });
    }, 150);
  }, []);

  return fire;
}
