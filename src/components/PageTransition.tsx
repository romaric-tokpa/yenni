"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const variants = reduceMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
        },
        exit: {
          opacity: 0,
          y: -6,
          transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
        },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={pathname} variants={variants} initial="initial" animate="animate" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
