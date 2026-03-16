"use client";

/**
 * Classe commune pour les modales responsive :
 * - Mobile : quasi plein écran (min-h-[85dvh])
 * - Desktop : centré, max-h-[90vh]
 */
export const modalContentClass =
  "glass-strong w-full sm:w-[480px] rounded-t-2xl sm:rounded-2xl p-6 lg:p-8 animate-slide-up min-h-[85dvh] sm:min-h-0 max-h-[95dvh] overflow-y-auto";

/**
 * Bouton touch-friendly (min 44px)
 */
export const modalButtonClass = "min-h-[44px] flex items-center justify-center touch-manipulation";
