import Link from "next/link";
import {
  ArrowRight,
  Wallet,
  PieChart,
  Smartphone,
  Shield,
  TrendingUp,
  Landmark,
  FolderKanban,
  HandCoins,
  LineChart,
  Check,
  ChevronRight,
} from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Multi-comptes",
    description:
      "Espèces, Mobile Money, banque, coffre : un solde calculé pour chaque compte à partir de tes opérations.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: PieChart,
    title: "Budget par catégorie",
    description:
      "Enveloppes mensuelles en FCFA, charges fixes et dépenses variables : vois où part ton argent.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: TrendingUp,
    title: "Indicateurs & exports",
    description:
      "Graphiques, historique filtrable, export CSV et PDF pour analyser tes mois.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Landmark,
    title: "Épargne & urgences",
    description:
      "Objectifs, fonds d’urgence et versements mois par mois, avec option coffre verrouillé.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: FolderKanban,
    title: "Projets",
    description:
      "Vacances, gros achats : épargne dédiée et suivi du montant collecté.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: HandCoins,
    title: "Prêts & dettes",
    description:
      "Échéancier, paiements liés à tes comptes, rappels dans l’app.",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

const checklist = [
  "Montants en francs CFA, pensé pour le quotidien mobile",
  "Transferts entre comptes sans confondre avec une dépense",
  "Installation sur l’écran d’accueil (PWA) pour un accès rapide",
  "Données stockées sur ton instance — sauvegarde exportable (JSON)",
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Fond décoratif — même vocabulaire que le dashboard (halos discrets) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-600/[0.04] blur-[80px]" />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-white/[0.02] blur-[90px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/[0.06] bg-[var(--bg-primary)]/80 backdrop-blur-xl backdrop-saturate-150 safe-top">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] rounded-lg"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- /api/logo est dynamique */}
              <img src="/api/logo" alt="Yenni" className="h-6 w-6 object-contain" width={24} height={24} />
            </span>
            <span className="font-semibold tracking-tight text-neutral-100 truncate">
              Yenni
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3" aria-label="Navigation principale">
            <a
              href="#fonctionnalites"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-neutral-200 sm:inline-block"
            >
              Fonctionnalités
            </a>
            <Link
              href="/login"
              prefetch={false}
              className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-neutral-200"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              prefetch={false}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm shadow-none sm:px-5"
            >
              Créer un compte
              <ArrowRight size={16} strokeWidth={2.5} className="hidden sm:inline" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center animate-slide-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400/95">
              Gestion financière personnelle
            </p>
            <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-neutral-100 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Ta trésorerie et ton budget{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                dans une seule app
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-neutral-500 sm:text-lg">
              Suis tes comptes réels, tes dépenses par catégorie et tes objectifs — en{" "}
              <span className="font-mono text-neutral-400">FCFA</span>, sans te perdre entre
              «&nbsp;argent sur Wave&nbsp;» et «&nbsp;ce qu’il me reste à dépenser ce mois-ci&nbsp;».
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                prefetch={false}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold shadow-[0_4px_24px_rgba(34,197,94,0.2)]"
              >
                Commencer gratuitement
                <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
              </Link>
              <Link
                href="/login"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-3.5 text-base font-semibold text-neutral-200 transition-colors hover:bg-white/[0.06] hover:border-white/15"
              >
                J’ai déjà un compte
              </Link>
            </div>
          </div>

          {/* Aperçu carte — pattern glass-strong du login */}
          <div className="mx-auto mt-14 max-w-4xl animate-slide-up opacity-0 [animation-delay:80ms] [animation-fill-mode:forwards]">
            <div className="glass-strong relative overflow-hidden rounded-2xl border border-white/[0.08] p-1 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div className="rounded-[13px] bg-[var(--bg-surface)]/90 p-5 sm:p-8">
                <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      Aperçu tableau de bord
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold text-emerald-400 tabular-nums sm:text-2xl">
                      Solde disponible (liquide)
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Espèces + Mobile Money — base du budget / jour
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                      Mois en cours
                    </span>
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      FCFA
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Passifs (sorties)", tone: "text-red-400" },
                    { label: "Budget catégories", tone: "text-emerald-400/90" },
                    { label: "Actifs (comptes)", tone: "text-green-500" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left"
                    >
                      <div className="text-[10px] text-neutral-500">{row.label}</div>
                      <div className={`mt-1 font-mono text-sm font-bold ${row.tone}`}>••••••</div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-center text-[11px] text-neutral-600">
                  Connexion sécurisée · Données sur ton serveur
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="fonctionnalites" className="border-t border-white/[0.06] bg-[var(--bg-surface)]/40 py-16 sm:py-20 scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Fonctionnalités
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-100 sm:text-3xl">
                Tout ce qu’il faut pour piloter ton argent au quotidien
              </h2>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {features.map(({ icon: Icon, title, description, accent, bg }) => (
                <div
                  key={title}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.035]"
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] ${bg}`}
                  >
                    <Icon size={20} className={accent} strokeWidth={2} aria-hidden />
                  </div>
                  <h3 className="font-semibold text-neutral-100">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bloc confiance / liste */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Pourquoi Yenni
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-100 sm:text-3xl">
                  Clarté entre{" "}
                  <span className="text-emerald-400">trésorerie</span> et{" "}
                  <span className="text-neutral-300">budget mensuel</span>
                </h2>
                <p className="mt-4 text-neutral-500 leading-relaxed">
                  L’app ne remplace pas ta banque : tu enregistres tes mouvements, et les soldes suivent.
                  Idéal si tu gères plusieurs moyens de paiement au quotidien.
                </p>
                <ul className="mt-8 space-y-3">
                  {checklist.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-neutral-300">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <Check size={14} strokeWidth={2.5} aria-hidden />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass-strong rounded-2xl border border-white/[0.08] p-6 sm:p-8">
                <div className="flex items-center gap-2 text-emerald-400 mb-4">
                  <Smartphone size={22} strokeWidth={1.75} aria-hidden />
                  <LineChart size={22} strokeWidth={1.75} aria-hidden />
                  <Shield size={22} strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-neutral-100">Calendrier, envies, courses</h3>
                <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
                  Visualise tes dépenses dans le temps, tiens des listes d’envies et de courses avec montants,
                  et reçois des rappels pour les échéances et dépenses planifiées — le tout dans le même design
                  sobre que le reste de l’app.
                </p>
                <Link
                  href="/register"
                  prefetch={false}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Découvrir en créant un compte
                  <ChevronRight size={16} strokeWidth={2.5} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-white/[0.06] bg-gradient-to-b from-emerald-500/[0.06] to-transparent py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-100 sm:text-3xl">
              Prêt à reprendre la main sur tes finances ?
            </h2>
            <p className="mt-3 text-neutral-500">
              Crée ton compte en quelques secondes — aucune carte bancaire requise pour tester.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                prefetch={false}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold"
              >
                Créer mon compte
                <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
              </Link>
              <Link
                href="/login"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-8 py-3.5 text-base font-semibold text-neutral-300 hover:bg-white/[0.04]"
              >
                Connexion
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] bg-[var(--bg-surface)]/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/logo" alt="Yenni" className="h-6 w-6 opacity-80" width={24} height={24} />
            <span>
              <span className="font-semibold text-neutral-400">Yenni</span>
              <span className="mx-2 text-neutral-700">·</span>
              Gestion financière personnelle
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500">
            <Link href="/login" prefetch={false} className="hover:text-emerald-400 transition-colors">
              Connexion
            </Link>
            <Link href="/register" prefetch={false} className="hover:text-emerald-400 transition-colors">
              Inscription
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
