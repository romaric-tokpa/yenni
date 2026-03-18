"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatCFA } from "@/lib/constants";
import { Plus, Trash2, X, Heart, Check, Pencil, ShoppingBag } from "lucide-react";
import type { Wish } from "@/lib/types";
import type { BudgetConfig, Category, WishCategory, WishSubcategory } from "@/lib/types";

export default function WishesView({
  config,
  showToast,
  updateConfig,
  onPurchaseComplete,
}: {
  config: BudgetConfig;
  showToast: (m: string, t?: string) => void;
  updateConfig?: (c: BudgetConfig) => Promise<void>;
  onPurchaseComplete?: () => void;
}) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState<Wish | null>(null);
  const [editingWish, setEditingWish] = useState<Wish | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const fetchWishes = useCallback(async () => {
    try {
      const r = await fetch("/api/wishes");
      if (r.ok) setWishes(await r.json());
    } catch {
      setWishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWishes();
  }, [fetchWishes]);

  useEffect(() => {
    const id = searchParams.get("highlight");
    if (id && wishes.length > 0) {
      const numId = parseInt(id, 10);
      const w = wishes.find((x) => x.id === numId);
      if (w && w.status === "pending") {
        setHighlightedId(numId);
        router.replace("/wishes", { scroll: false });
        const t = setTimeout(() => setHighlightedId(null), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [searchParams, wishes, router]);

  const pendingWishes = wishes.filter((w) => w.status === "pending");
  const purchasedWishes = wishes.filter((w) => w.status === "purchased");

  /** Catégories d'envies : personnalisées si définies, sinon fallback sur les catégories budget */
  const wishCategoriesRaw = (config.wishCategories ?? []).length > 0
    ? config.wishCategories!
    : config.categories.map((c: Category) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color, subcategories: [] }));
  const wishCategories = wishCategoriesRaw.length > 0
    ? wishCategoriesRaw
    : [{ id: "misc", label: "Divers", icon: "wrench", color: "#78716C" }];

  /** Grouper les envies par catégorie puis sous-catégorie */
  const knownCatIds = new Set(wishCategories.map((c) => c.id));
  const uncategorizedWishes = pendingWishes.filter((w) => !knownCatIds.has(w.category));
  type SubGroup = { subcategory: WishSubcategory | null; wishes: Wish[] };
  type CatGroup = { category: WishCategory; subGroups: SubGroup[] };
  const wishesByCategory: CatGroup[] = wishCategories
    .map((cat) => {
      const catWishes = pendingWishes.filter((w) => w.category === cat.id);
      if (catWishes.length === 0) return null;
      const subs = cat.subcategories ?? [];
      const subIds = new Set(subs.map((s) => s.id));
      const subGroups: SubGroup[] = [];
      for (const sub of subs) {
        const w = catWishes.filter((x) => x.subcategory === sub.id);
        if (w.length > 0) subGroups.push({ subcategory: sub, wishes: w });
      }
      const noSub = catWishes.filter((x) => !x.subcategory || x.subcategory === "" || !subIds.has(x.subcategory!));
      if (noSub.length > 0) subGroups.unshift({ subcategory: null, wishes: noSub });
      return { category: cat, subGroups };
    })
    .filter((x): x is CatGroup => x !== null);
  if (uncategorizedWishes.length > 0) {
    wishesByCategory.push({
      category: { id: "misc", label: "Autres", icon: "wrench", color: "#78716C", subcategories: [] },
      subGroups: [{ subcategory: null, wishes: uncategorizedWishes }],
    });
  }

  const defaultCategoryId = wishCategories[0]?.id || "misc";

  const [form, setForm] = useState({
    name: "",
    target_date: "",
    estimated_amount: "",
    category: defaultCategoryId,
    subcategory: "" as string | null,
    notes: "",
  });

  const [newSubLabel, setNewSubLabel] = useState("");

  const openAddModal = (categoryId?: string) => {
    setForm({
      name: "",
      target_date: "",
      estimated_amount: "",
      category: categoryId || defaultCategoryId,
      subcategory: null,
      notes: "",
    });
    setNewSubLabel("");
    setShowAddModal(true);
  };

  const addSubcategoryToConfig = (categoryId: string, label: string) => {
    if (!label.trim() || !updateConfig) return;
    const cats = config.wishCategories ?? [];
    const cat = cats.find((c) => c.id === categoryId);
    if (!cat) return;
    const subs = cat.subcategories ?? [];
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newSub: WishSubcategory = { id, label: label.trim() };
    const updated = cats.map((c) =>
      c.id === categoryId ? { ...c, subcategories: [...(c.subcategories ?? []), newSub] } : c
    );
    updateConfig({ ...config, wishCategories: updated });
    setForm((f) => ({ ...f, subcategory: id }));
    setNewSubLabel("");
    showToast("Sous-catégorie créée !");
  };

  const handleAdd = async () => {
    if (!form.name || !form.target_date || !form.estimated_amount || Number(form.estimated_amount) < 0) {
      showToast("Remplis tous les champs obligatoires", "error");
      return;
    }
    try {
      const r = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          target_date: form.target_date,
          estimated_amount: Number(form.estimated_amount),
          category: form.category,
          subcategory: form.subcategory || null,
          notes: form.notes,
        }),
      });
      if (r.ok) {
        showToast("Envie ajoutée !");
        setForm({ name: "", target_date: "", estimated_amount: "", category: defaultCategoryId, subcategory: null, notes: "" });
        setShowAddModal(false);
        await fetchWishes();
      } else {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || "Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  const handleUpdate = async (id: number, updates: Partial<Wish>) => {
    try {
      const r = await fetch(`/api/wishes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (r.ok) {
        showToast("Envie modifiée !");
        setEditingWish(null);
        await fetchWishes();
        if (editingWish?.status === "purchased") onPurchaseComplete?.();
      } else {
        showToast("Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  const handlePurchase = async () => {
    if (!showPurchaseModal) return;
    const amount = Number(purchaseAmount);
    if (isNaN(amount) || amount < 0) {
      showToast("Montant réel invalide", "error");
      return;
    }
    try {
      const r = await fetch(`/api/wishes/${showPurchaseModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", actual_amount: amount }),
      });
      if (r.ok) {
        showToast("Achat enregistré ! La dépense a été créée.");
        setShowPurchaseModal(null);
        setPurchaseAmount("");
        await fetchWishes();
        onPurchaseComplete?.();
      } else {
        const data = await r.json().catch(() => ({}));
        showToast(data.error || "Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/wishes/${id}`, { method: "DELETE" });
    showToast("Envie supprimée", "info");
    await fetchWishes();
  };

  const getDueLabel = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: "En retard", cls: "text-red-400" };
    if (diff === 0) return { text: "Aujourd'hui", cls: "text-amber-400" };
    if (diff === 1) return { text: "Demain", cls: "text-amber-300" };
    if (diff <= 7) return { text: `Dans ${diff}j`, cls: "text-blue-400" };
    return { text: `Dans ${diff}j`, cls: "text-slate-400" };
  };

  if (loading) {
    return (
      <div className="animate-slide-up">
        <div className="glass-strong rounded-2xl py-16 text-center text-slate-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart size={24} className="text-pink-400" />
            Liste des envies
          </h1>
          <p className="text-neutral-500 text-xs lg:text-sm mt-1">
            {pendingWishes.length} en attente · {purchasedWishes.length} achetées
          </p>
          {(config.wishCategories ?? []).length === 0 && (
            <p className="text-[10px] text-slate-500 mt-1">
              <Link href="/settings" className="text-pink-400/80 hover:text-pink-400 underline">
                Définir des catégories d&apos;envies personnalisées
              </Link>
            </p>
          )}
        </div>
        <button
          onClick={() => openAddModal()}
          className="btn-primary px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shrink-0"
        >
          <Plus size={18} strokeWidth={2.5} />
          Ajouter une envie
        </button>
      </div>

      {/* En attente — groupé par catégorie */}
      <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <ShoppingBag size={16} className="text-pink-400" />
          À acheter ({pendingWishes.length})
        </h2>
        {pendingWishes.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Heart size={48} className="mx-auto mb-3 opacity-80" />
            <p className="text-sm">Aucune envie en attente</p>
            <button
              onClick={() => openAddModal()}
              className="mt-4 btn-primary px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter une envie
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {wishesByCategory.map(({ category: cat, subGroups }) => (
              <div key={cat.id} className="rounded-xl border border-white/5 overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ background: (cat.color || "#6366f1") + "15" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: (cat.color || "#6366f1") + "30", color: cat.color }}
                    >
                      {cat.label.charAt(0)}
                    </span>
                    <span className="font-medium text-slate-300" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({subGroups.reduce((s, g) => s + g.wishes.length, 0)})
                    </span>
                  </div>
                  <button
                    onClick={() => openAddModal(cat.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    style={{ background: (cat.color || "#6366f1") + "40", color: cat.color }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Ajouter
                  </button>
                </div>
                <div className="p-3 space-y-4 bg-black/20">
                  {subGroups.map(({ subcategory: sub, wishes: catWishes }) => (
                    <div key={sub?.id ?? "none"} className="space-y-2">
                      {sub && (
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide px-1">
                          {sub.label}
                        </p>
                      )}
                      {catWishes.map((w) => {
                        const dl = getDueLabel(w.target_date);
                        const isHighlighted = highlightedId === w.id;
                        return (
                          <div
                            key={w.id}
                            className={`rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                              isHighlighted ? "ring-2 ring-pink-500/50 bg-pink-500/20" : "glass border border-white/5"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-400 truncate">{w.name}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-emerald-400">~{formatCFA(w.estimated_amount)}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(w.target_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                                <span className={`text-[10px] font-medium ${dl.cls}`}>{dl.text}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setShowPurchaseModal(w)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                              >
                                <Check size={14} />
                                Acheté
                              </button>
                              <button
                                onClick={() => setEditingWish(w)}
                                className="p-2 rounded-lg hover:bg-white/5 text-slate-500"
                              >
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleDelete(w.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achetées */}
      {purchasedWishes.length > 0 && (
        <div className="glass-strong rounded-2xl p-4 lg:p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Check size={16} className="text-emerald-400" />
            Achetées ({purchasedWishes.length})
          </h2>
          <div className="space-y-2">
            {purchasedWishes.map((w) => {
              const actual = w.actual_amount ?? w.estimated_amount;
              const diff = actual - w.estimated_amount;
              const diffCls = diff > 0 ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-slate-500";
              const diffLabel = diff > 0 ? `+${formatCFA(diff)}` : diff < 0 ? formatCFA(diff) : "0";
              return (
                <div key={w.id} className="rounded-xl p-3 flex items-center gap-3 glass border border-white/5">
                  <Check size={18} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-400 truncate">{w.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
                      <span className="text-slate-500">
                        Prévisionnel : <span className="font-mono text-slate-400">{formatCFA(w.estimated_amount)}</span>
                      </span>
                      <span className="text-slate-500">
                        Réel : <span className="font-mono text-emerald-400">{formatCFA(actual)}</span>
                      </span>
                      <span className={diffCls}>
                        Écart : <span className="font-mono">{diffLabel} FCFA</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingWish(w)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-400">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Ajouter */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowAddModal(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Heart size={18} className="text-pink-400" />
                Ajouter une envie
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white p-1"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Article *</label>
                <input className="input-field" placeholder="Ex: Nouveau smartphone" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Date prévue *</label>
                  <input type="date" className="input-field" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Prix prévisionnel *</label>
                  <input type="number" className="input-field font-mono" placeholder="0" value={form.estimated_amount} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie</label>
                <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: null })}>
                  {wishCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const cat = wishCategories.find((c) => c.id === form.category);
                const subs = cat?.subcategories ?? [];
                return (
                  <div>
                    <label className="text-xs text-neutral-500 mb-1.5 block">Sous-catégorie (optionnel)</label>
                    <select className="input-field" value={form.subcategory ?? ""} onChange={(e) => setForm({ ...form, subcategory: e.target.value || null })}>
                      <option value="">Aucune</option>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    {updateConfig && (
                      <div className="flex gap-2 mt-2">
                        <input
                          className="input-field flex-1 text-xs py-2 px-3"
                          placeholder="Créer une sous-catégorie..."
                          value={newSubLabel}
                          onChange={(e) => setNewSubLabel(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addSubcategoryToConfig(form.category, newSubLabel)}
                        />
                        <button
                          type="button"
                          onClick={() => addSubcategoryToConfig(form.category, newSubLabel)}
                          className="btn-primary px-3 py-2 text-xs rounded-lg shrink-0"
                        >
                          Créer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Notes (optionnel)</label>
                <input className="input-field" placeholder="Détails..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium">Annuler</button>
              <button onClick={handleAdd} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                <Plus size={16} /> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Marquer acheté */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowPurchaseModal(null)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Check size={18} className="text-emerald-400" />
                Marquer comme acheté
              </h2>
              <button onClick={() => setShowPurchaseModal(null)} className="text-neutral-400 hover:text-white p-1"><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{showPurchaseModal.name}</p>
            <p className="text-xs text-slate-500 mb-2">Prix prévisionnel : {formatCFA(showPurchaseModal.estimated_amount)}</p>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Coût réel d&apos;achat *</label>
              <input
                type="number"
                className="input-field font-mono" placeholder="0"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Une dépense sera créée avec ce montant.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPurchaseModal(null)} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium">Annuler</button>
              <button onClick={handlePurchase} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                <Check size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {editingWish && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setEditingWish(null)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Pencil size={18} className="text-pink-400" />
                Modifier l&apos;envie
              </h2>
              <button onClick={() => setEditingWish(null)} className="text-neutral-400 hover:text-white p-1"><X size={20} /></button>
            </div>
            <EditWishForm
              wish={editingWish}
              wishCategories={wishCategories}
              updateConfig={updateConfig}
              config={config}
              onSave={(updates) => handleUpdate(editingWish.id, updates)}
              onCancel={() => setEditingWish(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EditWishForm({
  wish,
  wishCategories,
  updateConfig,
  config,
  onSave,
  onCancel,
}: {
  wish: Wish;
  wishCategories: WishCategory[];
  updateConfig?: (c: BudgetConfig) => Promise<void>;
  config?: BudgetConfig;
  onSave: (updates: Partial<Wish>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(wish.name);
  const [target_date, setTargetDate] = useState(wish.target_date);
  const [estimated_amount, setEstimatedAmount] = useState(String(wish.estimated_amount));
  const [actual_amount, setActualAmount] = useState(wish.status === "purchased" ? String(wish.actual_amount ?? wish.estimated_amount) : "");
  const [category, setCategory] = useState(wish.category);
  const [subcategory, setSubcategory] = useState<string | null>(wish.subcategory ?? null);
  const [notes, setNotes] = useState(wish.notes);
  const [newSubLabel, setNewSubLabel] = useState("");

  const cat = wishCategories.find((c) => c.id === category);
  const subs = cat?.subcategories ?? [];

  const addSub = () => {
    if (!newSubLabel.trim() || !updateConfig || !config) return;
    const cats = config.wishCategories ?? [];
    const targetCat = cats.find((c) => c.id === category);
    if (!targetCat) return;
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newSub: WishSubcategory = { id, label: newSubLabel.trim() };
    const updated = cats.map((c) =>
      c.id === category ? { ...c, subcategories: [...(c.subcategories ?? []), newSub] } : c
    );
    updateConfig({ ...config, wishCategories: updated });
    setSubcategory(id);
    setNewSubLabel("");
  };

  return (
    <>
      <div className="grid gap-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Article *</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Date prévue *</label>
            <input type="date" className="input-field" value={target_date} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Prix prévisionnel *</label>
            <input type="number" className="input-field font-mono" value={estimated_amount} onChange={(e) => setEstimatedAmount(e.target.value)} />
          </div>
        </div>
        {wish.status === "purchased" && (
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Prix réel d&apos;achat *</label>
            <input type="number" className="input-field font-mono" value={actual_amount} onChange={(e) => setActualAmount(e.target.value)} placeholder="Montant payé" />
            <p className="text-[10px] text-slate-500 mt-1">La dépense liée sera mise à jour.</p>
          </div>
        )}
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie</label>
          <select className="input-field" value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(null); }}>
            {wishCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Sous-catégorie (optionnel)</label>
          <select className="input-field" value={subcategory ?? ""} onChange={(e) => setSubcategory(e.target.value || null)}>
            <option value="">Aucune</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {updateConfig && (
            <div className="flex gap-2 mt-2">
              <input className="input-field flex-1 text-xs py-2 px-3" placeholder="Créer une sous-catégorie..."
                value={newSubLabel} onChange={(e) => setNewSubLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSub()} />
              <button type="button" onClick={addSub} className="btn-primary px-3 py-2 text-xs rounded-lg">Créer</button>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Notes</label>
          <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium">Annuler</button>
        <button
          onClick={() => onSave({
            name,
            target_date,
            estimated_amount: Number(estimated_amount) || 0,
            ...(wish.status === "purchased" && actual_amount ? { actual_amount: Number(actual_amount) || 0 } : {}),
            category,
            subcategory,
            notes,
          })}
          className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
        >
          <Check size={16} /> Enregistrer
        </button>
      </div>
    </>
  );
}
