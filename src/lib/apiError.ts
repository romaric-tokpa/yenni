/**
 * Réponse d'erreur API sécurisée :
 * - En production : n'expose jamais les détails internes
 * - En développement : inclut les détails pour le debug
 */
export function apiErrorResponse(err: unknown, status = 500) {
  const isDev = process.env.NODE_ENV !== "production";
  const details = err instanceof Error ? err.message : String(err);
  return {
    error: "Erreur serveur",
    ...(isDev && { details }),
  };
}
