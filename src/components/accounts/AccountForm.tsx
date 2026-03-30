"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBudgetContext } from "@/contexts/BudgetContext";
import { ACCOUNT_KIND_PRESETS, MOBILE_MONEY_PROVIDERS, AVAILABLE_ICONS } from "@/lib/constants";
import AccountGlyph from "@/components/ui/AccountGlyph";
import Icon from "@/components/ui/Icon";
import {
  accountKindAllowsLogo,
  accountKindIsBank,
  MAX_ACCOUNT_LOGO_BYTES,
  ACCOUNT_LOGO_ACCEPT,
} from "@/lib/accountLogoShared";
import { ChevronLeft, Check, Upload, Link2, Loader2 } from "lucide-react";
import type { AccountWithBalance } from "@/lib/types";

function accountToFormState(acc: AccountWithBalance) {
  const logo = acc.logo_url?.trim() ?? "";
  return {
    name: acc.name ?? "",
    kind: acc.kind ?? "cash",
    subtype: acc.subtype ?? "",
    institution_name: acc.institution_name ?? "",
    opening_balance: acc.opening_balance != null ? String(acc.opening_balance) : "",
    notes: acc.notes ?? "",
    icon: acc.icon ?? "wallet",
    color: acc.color ?? "#6366f1",
    logoDataUri: logo.startsWith("data:image/") ? logo : "",
  };
}

function defaultIconForKind(kind: string): string {
  if (kind === "cash") return "banknote";
  if (kind.startsWith("bank_")) return "landmark";
  return "wallet";
}

function defaultColorForKind(kind: string): string {
  if (kind === "cash") return "#10B981";
  if (kind.startsWith("bank_")) return "#3B82F6";
  return "#6366f1";
}

const EMPTY_NEW_FORM = {
  name: "",
  kind: "cash" as string,
  subtype: "",
  institution_name: "",
  opening_balance: "",
  notes: "",
  icon: "banknote",
  color: "#10B981",
  logoDataUri: "",
};

export default function AccountForm({ editAccountId }: { editAccountId?: number }) {
  const router = useRouter();
  const isEdit = editAccountId != null;
  const { showToast, fetchAccounts, accountsWithBalance, loading: budgetLoading } = useBudgetContext();
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW_FORM });
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoUrlLoading, setLogoUrlLoading] = useState(false);
  const [editHydrated, setEditHydrated] = useState(false);

  const account = useMemo(
    () => (editAccountId != null ? accountsWithBalance.find((a) => a.id === editAccountId) : undefined),
    [editAccountId, accountsWithBalance],
  );

  useEffect(() => {
    setEditHydrated(false);
  }, [editAccountId]);

  useEffect(() => {
    if (!isEdit || !account) return;
    setNewForm(accountToFormState(account));
    setLogoUrlInput("");
    setEditHydrated(true);
  }, [isEdit, account]);

  const buildPayload = useCallback((): Record<string, unknown> | null => {
    if (!newForm.name.trim()) {
      showToast("Indique un nom de compte", "error");
      return null;
    }
    const mmProv =
      newForm.kind === "mobile_money"
        ? MOBILE_MONEY_PROVIDERS.find((p) => p.id === (newForm.subtype || MOBILE_MONEY_PROVIDERS[0].id))
        : undefined;

    const payload: Record<string, unknown> = {
      name: newForm.name.trim(),
      kind: newForm.kind,
      subtype: newForm.kind === "mobile_money" ? newForm.subtype || MOBILE_MONEY_PROVIDERS[0].id : "",
      notes: newForm.notes,
      opening_balance: newForm.opening_balance ? Number(newForm.opening_balance) : 0,
      logo_url: accountKindAllowsLogo(newForm.kind)
        ? (newForm.logoDataUri.trim() || logoUrlInput.trim())
        : "",
      institution_name: newForm.kind.startsWith("bank_") ? newForm.institution_name.trim() : "",
    };

    if (isEdit && newForm.kind === "bank_blocked_savings") {
      payload.vault_unlocks_on = null;
    }

    if (mmProv) {
      payload.icon = "smartphone";
      payload.color = mmProv.color;
    } else if (newForm.kind.startsWith("bank_")) {
      payload.icon = "landmark";
      payload.color = newForm.color || defaultColorForKind(newForm.kind);
    } else {
      payload.icon = newForm.icon || "wallet";
      payload.color = newForm.color || "#6366f1";
    }

    return payload;
  }, [newForm, logoUrlInput, showToast, isEdit]);

  const handleCreate = useCallback(async () => {
    const payload = buildPayload();
    if (!payload) return;
    const r = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      showToast(err.error || "Erreur lors de la création", "error");
      return;
    }
    showToast("Compte créé !");
    setNewForm({ ...EMPTY_NEW_FORM });
    setLogoUrlInput("");
    await fetchAccounts();
    router.push("/settings/accounts");
  }, [buildPayload, showToast, fetchAccounts, router]);

  const handleUpdate = useCallback(async () => {
    if (editAccountId == null) return;
    const payload = buildPayload();
    if (!payload) return;

    const r = await fetch(`/api/accounts/${editAccountId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      showToast(err.error || "Erreur lors de l’enregistrement", "error");
      return;
    }
    showToast("Compte mis à jour !");
    await fetchAccounts();
    router.push(`/settings/accounts/${editAccountId}`);
  }, [editAccountId, buildPayload, showToast, fetchAccounts, router]);

  const keepLogoBetweenKinds = (from: string, to: string) =>
    accountKindAllowsLogo(from) && accountKindAllowsLogo(to);

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const accepted = ACCOUNT_LOGO_ACCEPT.split(",").map((x) => x.trim());
    if (!accepted.includes(file.type)) {
      showToast("Format : JPG, PNG, WebP ou GIF", "error");
      return;
    }
    if (file.size > MAX_ACCOUNT_LOGO_BYTES) {
      showToast("Image trop lourde (max 400 Ko)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewForm((f) => ({ ...f, logoDataUri: reader.result as string }));
    };
    reader.readAsDataURL(file);
    setLogoUrlInput("");
  };

  const loadLogoFromUrl = async () => {
    const url = logoUrlInput.trim();
    if (!url) {
      showToast("Colle d’abord une URL (https://…)", "error");
      return;
    }
    if (!url.startsWith("https://")) {
      showToast("L’URL doit commencer par https://", "error");
      return;
    }
    setLogoUrlLoading(true);
    try {
      const r = await fetch("/api/accounts/resolve-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(j.error || "Impossible de charger l’image", "error");
        return;
      }
      setNewForm((f) => ({ ...f, logoDataUri: j.dataUri || "" }));
      showToast("Logo chargé depuis le web");
    } finally {
      setLogoUrlLoading(false);
    }
  };

  const applyKindPreset = (kind: string) => {
    setNewForm((f) => {
      const preservedLogo = keepLogoBetweenKinds(f.kind, kind) ? f.logoDataUri : "";
      if (kind === "mobile_money") {
        const sub =
          f.subtype && MOBILE_MONEY_PROVIDERS.some((p) => p.id === f.subtype)
            ? f.subtype
            : MOBILE_MONEY_PROVIDERS[0].id;
        const prov = MOBILE_MONEY_PROVIDERS.find((p) => p.id === sub) ?? MOBILE_MONEY_PROVIDERS[0];
        return {
          ...f,
          kind,
          subtype: sub,
          institution_name: "",
          name: f.name.trim() ? f.name : prov.label,
          icon: "smartphone",
          color: prov.color,
          logoDataUri: preservedLogo,
        };
      }
      if (kind.startsWith("bank_")) {
        const logoPreserved = keepLogoBetweenKinds(f.kind, kind) ? f.logoDataUri : "";
        const instPreserved =
          f.kind.startsWith("bank_") && kind.startsWith("bank_") ? f.institution_name : "";
        const presetLabel = ACCOUNT_KIND_PRESETS.find((p) => p.id === kind)?.label ?? "";
        return {
          ...f,
          kind,
          subtype: "",
          institution_name: instPreserved,
          name: f.name.trim() ? f.name : presetLabel,
          icon: "landmark",
          color: defaultColorForKind(kind),
          logoDataUri: logoPreserved,
        };
      }
      const label = ACCOUNT_KIND_PRESETS.find((p) => p.id === kind)?.label ?? "";
      return {
        ...f,
        kind,
        notes: f.notes,
        subtype: "",
        institution_name: "",
        name: f.name.trim() ? f.name : label,
        icon: defaultIconForKind(kind),
        color: defaultColorForKind(kind),
        logoDataUri: "",
      };
    });
  };

  const backHref =
    isEdit && editAccountId != null ? `/settings/accounts/${editAccountId}` : "/settings/accounts";

  if (isEdit && budgetLoading) {
    return (
      <div className="animate-slide-up max-w-lg mx-auto pb-24 flex flex-col items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-3" aria-hidden />
        <p className="text-sm text-neutral-500">Chargement du compte…</p>
      </div>
    );
  }

  if (isEdit && !budgetLoading && !account) {
    return (
      <div className="animate-slide-up max-w-lg mx-auto pb-24">
        <Link
          href="/settings/accounts"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-200 mb-4"
        >
          <ChevronLeft size={18} />
          Trésorerie
        </Link>
        <p className="text-neutral-400 text-sm">Ce compte n’existe pas ou n’est plus disponible.</p>
      </div>
    );
  }

  if (isEdit && !editHydrated) {
    return (
      <div className="animate-slide-up max-w-lg mx-auto pb-24 flex flex-col items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-3" aria-hidden />
        <p className="text-sm text-neutral-500">Préparation du formulaire…</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up max-w-lg mx-auto pb-24">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-200 mb-4"
      >
        <ChevronLeft size={18} />
        {isEdit ? "Retour au compte" : "Comptes"}
      </Link>

      <h1 className="text-xl font-bold tracking-tight mb-6">{isEdit ? "Modifier le compte" : "Nouveau compte"}</h1>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Type</label>
          <select className="input-field" value={newForm.kind} onChange={(e) => applyKindPreset(e.target.value)}>
            {ACCOUNT_KIND_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {newForm.kind === "bank_blocked_savings" && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
            <p className="text-xs text-cyan-100/90 leading-relaxed">
              <strong className="text-cyan-50">Plan d’épargne :</strong> compte bancaire dédié ; les entrées et sorties
              sont libres comme sur un compte courant (selon ton solde).
            </p>
          </div>
        )}

        {newForm.kind === "mobile_money" && (
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Opérateur / réseau</label>
            <select
              className="input-field"
              value={newForm.subtype || MOBILE_MONEY_PROVIDERS[0].id}
              onChange={(e) => {
                const id = e.target.value;
                const prov = MOBILE_MONEY_PROVIDERS.find((p) => p.id === id);
                setNewForm((f) => ({
                  ...f,
                  subtype: id,
                  name: f.name.trim() ? f.name : prov?.label ?? "",
                  color: prov?.color ?? f.color,
                  icon: "smartphone",
                }));
              }}
            >
              {MOBILE_MONEY_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-500 mt-1">
              Wave, Orange Money, MTN… Tu peux ajuster le nom du compte ci-dessous.
            </p>
          </div>
        )}

        {newForm.kind.startsWith("bank_") && (
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Nom de la banque</label>
            <input
              className="input-field"
              value={newForm.institution_name}
              onChange={(e) => setNewForm((f) => ({ ...f, institution_name: e.target.value }))}
              placeholder="Ex : Ecobank, BIS, UBA…"
              autoComplete="organization"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Affiché avec le type de compte. Le nom du compte ci-dessous peut préciser le libellé du compte (ex. Compte
              courant principal).
            </p>
          </div>
        )}

        {accountKindAllowsLogo(newForm.kind) && (
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">
              {accountKindIsBank(newForm.kind) ? "Logo de la banque (optionnel)" : "Logo opérateur (optionnel)"}
            </label>
            <input ref={logoFileRef} type="file" className="hidden" accept={ACCOUNT_LOGO_ACCEPT} onChange={onLogoFile} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden bg-white/[0.04] shrink-0">
                {newForm.logoDataUri ? (
                  <img src={newForm.logoDataUri} alt="" className="w-full h-full object-contain" />
                ) : (
                  <AccountGlyph account={{ icon: newForm.icon, color: newForm.color }} size={22} />
                )}
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-200 hover:bg-white/5 flex items-center gap-2 w-fit"
                  onClick={() => logoFileRef.current?.click()}
                >
                  <Upload size={14} className="shrink-0" />
                  Choisir une image
                </button>
                {newForm.logoDataUri ? (
                  <button
                    type="button"
                    className="text-[11px] text-red-400 hover:underline w-fit"
                    onClick={() => {
                      setNewForm((f) => ({ ...f, logoDataUri: "" }));
                      setLogoUrlInput("");
                    }}
                  >
                    Retirer le logo
                  </button>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 mt-3 pt-3 border-t border-white/5">
              <label className="text-xs text-neutral-500 block">Ou image sur internet (URL https)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  className="input-field font-mono text-xs flex-1"
                  placeholder="https://exemple.com/logo.png"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={logoUrlLoading}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-white/15 text-neutral-200 hover:bg-white/5 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                  onClick={() => void loadLogoFromUrl()}
                >
                  {logoUrlLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                  Charger
                </button>
              </div>
              <p className="text-[10px] text-neutral-500">
                Tu peux aussi coller l’URL et enregistrer : l’image sera récupérée au moment de
                l’enregistrement.
              </p>
            </div>
            {accountKindIsBank(newForm.kind) && (
              <div className="mt-3">
                <label className="text-xs text-neutral-500 mb-1 block">Couleur de secours (sans logo)</label>
                <input
                  type="color"
                  className="h-9 w-full max-w-[120px] rounded cursor-pointer bg-transparent border border-white/10"
                  value={newForm.color}
                  onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
            )}
            <p className="text-[10px] text-neutral-500 mt-1.5">
              JPG, PNG, WebP ou GIF — max 400&nbsp;Ko.
              {accountKindIsBank(newForm.kind)
                ? " Sans logo, l’icône banque s’affiche avec cette couleur."
                : " Sans logo, l’icône du type de compte s’affiche."}
            </p>
          </div>
        )}

        {!accountKindAllowsLogo(newForm.kind) && (
          <div className="space-y-2">
            <label className="text-xs text-neutral-500 mb-1 block">Icône du compte</label>
            <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-white/10 bg-white/[0.02]">
              {AVAILABLE_ICONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => setNewForm((f) => ({ ...f, icon: name }))}
                  className={`p-2 rounded-lg flex items-center justify-center aspect-square ${
                    newForm.icon === name ? "ring-2 ring-emerald-500/80 bg-emerald-500/10" : "hover:bg-white/5"
                  }`}
                >
                  <Icon name={name} size={18} style={{ color: newForm.color || undefined }} />
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Couleur de l’icône</label>
              <input
                type="color"
                className="h-9 w-full max-w-[120px] rounded cursor-pointer bg-transparent border border-white/10"
                value={newForm.color}
                onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))}
              />
            </div>
            <p className="text-[10px] text-neutral-500">
              Espèces : pas de logo fichier, uniquement icône et couleur.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">
            {newForm.kind.startsWith("bank_") ? "Nom du compte (libellé)" : "Nom du compte"}
          </label>
          <input
            className="input-field"
            value={newForm.name}
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={
              newForm.kind.startsWith("bank_") ? "Ex : Compte courant principal" : "Ex: Wave principal"
            }
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Solde initial (FCFA)</label>
          <input
            type="number"
            className="input-field font-mono"
            value={newForm.opening_balance}
            onChange={(e) => setNewForm((f) => ({ ...f, opening_balance: e.target.value }))}
            placeholder="0"
          />
          {isEdit && (
            <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
              Changer le solde initial recalcule le solde affiché ; les opérations enregistrées ne sont pas modifiées
              (utile pour un rattrapage ou une correction).
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Notes</label>
          <input
            className="input-field"
            value={newForm.notes}
            onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optionnel"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Link
            href={backHref}
            className="flex-1 py-3 rounded-lg border border-white/10 text-neutral-400 text-center text-sm font-medium"
          >
            Annuler
          </Link>
          <button
            type="button"
            className="btn-primary flex-1 py-3 rounded-lg flex items-center justify-center gap-1 text-sm font-medium"
            onClick={isEdit ? handleUpdate : handleCreate}
          >
            <Check size={16} /> {isEdit ? "Enregistrer" : "Créer le compte"}
          </button>
        </div>
      </div>
    </div>
  );
}
