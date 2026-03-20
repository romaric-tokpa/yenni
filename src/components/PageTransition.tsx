"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Transition de page sans AnimatePresence + mode "wait" : ce combo faisait souvent
 * disparaître le flux (position absolute à la sortie) → écran vide au retour arrière du navigateur.
 * Ici : nouveau segment animé à l’entrée uniquement (fluide et fiable avec l’App Router).
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const initial = reduceMotion ? false : { opacity: 0, y: 8 };
  const animate = { opacity: 1, y: 0 };
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <motion.div
      key={pathname}
      initial={initial}
      animate={animate}
      transition={transition}
      className="relative w-full min-h-full"
    >
      {children}
    </motion.div>
  );
}
