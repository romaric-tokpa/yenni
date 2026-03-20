/**
 * Titres affichés dans l’en-tête (première règle qui correspond gagne).
 */
const RULES: { test: (p: string) => boolean; title: string }[] = [
  { test: (p) => p === "/settings/accounts" || p === "/settings/accounts/", title: "Trésorerie" },
  { test: (p) => p.startsWith("/settings/accounts/new"), title: "Nouveau compte" },
  { test: (p) => /\/settings\/accounts\/\d+\/edit/.test(p), title: "Modifier le compte" },
  { test: (p) => /^\/settings\/accounts\/\d/.test(p), title: "Mouvements du compte" },
  { test: (p) => p === "/loans/new", title: "Nouveau prêt" },
  { test: (p) => /^\/loans\/\d/.test(p), title: "Prêt" },
  { test: (p) => p === "/loans", title: "Prêts & dettes" },
  { test: (p) => p === "/transactions", title: "Transactions" },
  { test: (p) => p === "/calendar", title: "Calendrier" },
  { test: (p) => p === "/budget", title: "Budget" },
  { test: (p) => p === "/savings", title: "Épargne" },
  { test: (p) => p === "/wishes" || p.startsWith("/wishes/"), title: "Envies" },
  { test: (p) => p === "/shopping-lists" || p.startsWith("/shopping-lists/"), title: "Courses" },
  { test: (p) => p === "/projects" || p.startsWith("/projects/"), title: "Projets" },
  { test: (p) => p === "/history", title: "Historique" },
  { test: (p) => p.startsWith("/settings"), title: "Réglages" },
  { test: (p) => p === "/dashboard", title: "Accueil" },
];

export function getPageTitle(pathname: string | null): string {
  if (!pathname) return "Yenni";
  for (const { test, title } of RULES) {
    if (test(pathname)) return title;
  }
  return "Yenni";
}
