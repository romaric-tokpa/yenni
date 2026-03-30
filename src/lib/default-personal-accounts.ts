/**
 * Lot de comptes proposé par défaut (trésorerie personnelle type SGCI + mobile money).
 * Utilisé lors de la première connexion (aucun compte) ou pour compléter l’ancien seul compte « Espèces ».
 */
export const STANDARD_PERSONAL_FINANCE_ACCOUNTS = [
  {
    name: "Espèces (porte-monnaie)",
    kind: "cash",
    subtype: "",
    institution_name: "",
    notes: "L'argent que j'ai sur moi dans mon porte-monnaie.",
    icon: "banknote",
    color: "#10B981",
    sort_order: 0,
  },
  {
    name: "Compte courant SGCI",
    kind: "bank_current",
    subtype: "",
    institution_name: "SGCI",
    notes: "Compte bancaire courant sur lequel je reçois mon salaire.",
    icon: "landmark",
    color: "#3B82F6",
    sort_order: 1,
  },
  {
    name: "Compte épargne classique SGCI",
    kind: "bank_savings",
    subtype: "",
    institution_name: "SGCI",
    notes: "Compte épargne relié à mon compte courant à la SGCI.",
    icon: "landmark",
    color: "#0EA5E9",
    sort_order: 2,
  },
  {
    name: "Compte Crédimatique",
    kind: "bank_blocked_savings",
    subtype: "",
    institution_name: "SGCI",
    notes:
      "Épargne obligatoire en fin de mois : 200 000 F — engagement 12 mois (plan type Crédimatic / relevé banque).",
    icon: "landmark",
    color: "#8B5CF6",
    sort_order: 3,
  },
  {
    name: "Compte épargne-logement",
    kind: "bank_blocked_savings",
    subtype: "",
    institution_name: "SGCI",
    notes:
      "Épargne obligatoire en fin de mois : 30 000 F — engagement 5 ans (plan type épargne-logement / relevé banque).",
    icon: "landmark",
    color: "#6366F1",
    sort_order: 4,
  },
  {
    name: "Orange Money",
    kind: "mobile_money",
    subtype: "orange_money",
    institution_name: "",
    notes: "Compte courant mobile money du quotidien.",
    icon: "smartphone",
    color: "#FF7900",
    sort_order: 5,
  },
  {
    name: "Wave",
    kind: "mobile_money",
    subtype: "wave",
    institution_name: "",
    notes: "Compte courant mobile money du quotidien.",
    icon: "smartphone",
    color: "#21CBA6",
    sort_order: 6,
  },
] as const;

export type StandardPersonalFinanceAccountSpec = (typeof STANDARD_PERSONAL_FINANCE_ACCOUNTS)[number];
