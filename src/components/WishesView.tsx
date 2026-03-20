"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getModalHref } from "@/lib/modal";
import Link from "next/link";
import { formatCFA, MONTHS_FULL, getSelectableYears } from "@/lib/constants";
import { Plus, Trash2, X, Heart, Check, Pencil, ChevronDown, ChevronRight, ChevronLeft, MapPin, Phone, Store } from "lucide-react";
import Icon from "./ui/Icon";
import type { WishList, WishListItem } from "@/lib/types";
import type { BudgetConfig, Category, WishCategory, WishSubcategory } from "@/lib/types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMapsUrl(item: WishListItem): string | null {
  if (item.shop_lat != null && item.shop_lng != null) {
    return `https://www.google.com/maps?q=${item.shop_lat},${item.shop_lng}`;
  }
  if (item.shop_address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.shop_address)}`;
  }
  return null;
}

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
  const [lists, setLists] = useState<WishList[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<number, WishListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [editingList, setEditingList] = useState<WishList | null>(null);
  const [editingItem, setEditingItem] = useState<WishListItem | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const wishCategoriesRaw = (config.wishCategories ?? []).length > 0
    ? config.wishCategories!
    : config.categories.map((c: Category) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color, subcategories: [] }));
  const wishCategories = wishCategoriesRaw.length > 0
    ? wishCategoriesRaw
    : [{ id: "misc", label: "Divers", icon: "heart", color: "#EC4899", subcategories: [] }];
  const defaultCategory = wishCategories[0]?.id || "misc";

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const fetchLists = useCallback(async () => {
    try {
      const r = await fetch(`/api/wish-lists?month=${selectedMonth}&year=${selectedYear}`);
      if (r.ok) {
        const data = await r.json();
        setLists(data);
        for (const list of data) {
          const ir = await fetch(`/api/wish-lists/${list.id}/items`);
          if (ir.ok) {
            const items = await ir.json();
            setItemsByList((prev) => ({ ...prev, [list.id]: items }));
          }
        }
      }
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    const id = searchParams.get("highlight");
    if (id && lists.length > 0) {
      const numId = parseInt(id, 10);
      for (const list of lists) {
        const items = itemsByList[list.id] ?? [];
        const found = items.find((x) => x.id === numId);
        if (found) {
          setExpandedIds((prev) => new Set([...prev, list.id]));
          setHighlightedId(numId);
          router.replace("/wishes", { scroll: false });
          const t = setTimeout(() => setHighlightedId(null), 3000);
          return () => clearTimeout(t);
        }
      }
    }
  }, [searchParams, lists, itemsByList, router]);

  const fetchItems = useCallback(async (listId: number) => {
    const r = await fetch(`/api/wish-lists/${listId}/items`);
    if (r.ok) {
      const items = await r.json();
      setItemsByList((prev) => ({ ...prev, [listId]: items }));
    }
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const handleUpdateItem = async (listId: number, itemId: number, updates: Partial<WishListItem>) => {
    try {
      const r = await fetch(`/api/wish-lists/${listId}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (r.ok) {
        showToast("Article modifié !");
        setEditingItem(null);
        await fetchItems(listId);
      } else {
        showToast("Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  const handleUpdateList = async (id: number, updates: Partial<WishList>) => {
    try {
      const r = await fetch(`/api/wish-lists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (r.ok) {
        showToast("Liste modifiée !");
        setEditingList(null);
        await fetchLists();
      } else {
        showToast("Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  const handleDeleteList = async (id: number) => {
    await fetch(`/api/wish-lists/${id}`, { method: "DELETE" });
    showToast("Liste supprimée", "info");
    await fetchLists();
  };

  const handleDeleteItem = async (listId: number, itemId: number) => {
    await fetch(`/api/wish-lists/${listId}/items/${itemId}`, { method: "DELETE" });
    showToast("Article supprimé", "info");
    await fetchItems(listId);
  };

  const captureGeolocation = (callback: (lat: number, lng: number) => void) => {
    if (!navigator.geolocation) {
      showToast("Géolocalisation non supportée", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => callback(pos.coords.latitude, pos.coords.longitude),
      () => showToast("Impossible d'obtenir la position", "error")
    );
  };

  if (loading) {
    return (
      <div className="animate-slide-up">
        <div className="glass-strong rounded-2xl py-16 text-center text-slate-500">Chargement...</div>
      </div>
    );
  }

  const totalPending = lists.reduce((s, l) => s + (itemsByList[l.id] ?? []).filter((i) => i.status === "pending").length, 0);
  const totalPurchased = lists.reduce((s, l) => s + (itemsByList[l.id] ?? []).filter((i) => i.status === "purchased").length, 0);

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Heart size={24} className="text-pink-400" />
              Liste des envies
            </h1>
            <p className="text-neutral-500 text-xs lg:text-sm mt-1">
              {lists.length} liste{lists.length !== 1 ? "s" : ""} · {totalPending} en attente · {totalPurchased} achetées — {MONTHS_FULL[selectedMonth]} {selectedYear}
            </p>
            {(config.wishCategories ?? []).length === 0 && (
              <p className="text-[10px] text-slate-500 mt-1">
                <Link href="/settings" prefetch={false} className="text-pink-400/80 hover:text-pink-400 underline">
                  Définir des catégories d&apos;envies personnalisées
                </Link>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5">
              <button onClick={() => setSelectedMonth((selectedMonth - 1 + 12) % 12)} className="p-1.5 rounded text-neutral-500 hover:text-white" aria-label="Mois précédent">
                <ChevronLeft size={16} />
              </button>
              <select
                className="input-field bg-transparent border-0 py-1.5 px-2 text-sm min-w-[100px]"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {MONTHS_FULL.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <button onClick={() => setSelectedMonth((selectedMonth + 1) % 12)} className="p-1.5 rounded text-neutral-500 hover:text-white" aria-label="Mois suivant">
                <ChevronRight size={16} />
              </button>
            </div>
            <select
              className="input-field w-24"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {getSelectableYears().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
          onClick={() => router.push(getModalHref({ type: "new-wish-list", returnTo: "/wishes" }))}
          className="btn-primary px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shrink-0"
        >
          <Plus size={18} strokeWidth={2.5} />
          Nouvelle liste
        </button>
          </div>
        </div>

      {lists.length === 0 ? (
        <div className="glass-strong rounded-2xl py-16 text-center text-slate-500">
          <Heart size={48} className="mx-auto mb-3 opacity-80" />
          <p className="text-sm">Aucune liste d&apos;envies</p>
          <button
            onClick={() => router.push(getModalHref({ type: "new-wish-list", returnTo: "/wishes" }))}
            className="mt-4 btn-primary px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Créer une liste
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const items = itemsByList[list.id] ?? [];
            const pending = items.filter((i) => i.status === "pending");
            const purchased = items.filter((i) => i.status === "purchased");
            const totalEst = items.reduce((s, i) => s + i.estimated_amount, 0);
            const totalActual = purchased.reduce((s, i) => s + (i.actual_amount ?? 0), 0);
            const isExpanded = expandedIds.has(list.id);

            return (
              <div key={list.id} className="glass-strong rounded-2xl overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleExpand(list.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown size={18} className="text-slate-500 shrink-0" /> : <ChevronRight size={18} className="text-slate-500 shrink-0" />}
                    <div>
                      <p className="font-medium text-slate-300 truncate">{list.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(list.scheduled_date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}
                        {pending.length} à acheter · {purchased.length} achetés
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(getModalHref({ type: "new-wish-item", returnTo: "/wishes", listId: String(list.id), listName: list.name })); }}
                      className="px-3 py-1.5 rounded-lg bg-pink-500/20 text-pink-300 text-xs font-medium flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Article
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingList(list); }} className="p-2 rounded-lg hover:bg-white/5 text-slate-500">
                      <Pencil size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/5 p-4 space-y-4">
                    {pending.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">À acheter</p>
                        <div className="space-y-2">
                          {pending.map((item) => {
                            const cat = wishCategories.find((c) => c.id === (item.category || "misc")) ?? { label: item.category || "Divers", icon: "heart", color: "#EC4899" };
                            const dl = getDueLabel(item.target_date);
                            const isHighlighted = highlightedId === item.id;
                            const mapsUrl = getMapsUrl(item);
                            return (
                              <div
                                key={item.id}
                                className={`rounded-lg p-3 glass border border-white/5 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                                  isHighlighted ? "ring-2 ring-pink-500/50 bg-pink-500/20" : ""
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-slate-400 truncate">{item.name}</p>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                                      <Icon name={cat.icon} size={10} />
                                      {cat.label}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Budget : <span className="font-mono text-pink-400">{formatCFA(item.estimated_amount)}</span>
                                    {" · "}
                                    {new Date(item.target_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                                    {" · "}
                                    <span className={dl.cls}>{dl.text}</span>
                                  </p>
                                  {(item.shop_name || item.shop_phone || item.shop_address) && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-500">
                                      {item.shop_name && <span className="flex items-center gap-1"><Store size={10} />{item.shop_name}</span>}
                                      {item.shop_phone && <a href={`tel:${item.shop_phone}`} className="flex items-center gap-1 hover:text-pink-400"><Phone size={10} />{item.shop_phone}</a>}
                                      {mapsUrl && (
                                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-pink-400 hover:underline">
                                          <MapPin size={10} /> Voir sur la carte
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => router.push(getModalHref({ type: "purchase-wish", returnTo: "/wishes", listId: String(list.id), itemId: String(item.id) }))}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1"
                                  >
                                    <Check size={14} />
                                    Acheté
                                  </button>
                                  <button onClick={() => setEditingItem(item)} className="p-2 rounded-lg hover:bg-white/5 text-slate-500">
                                    <Pencil size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteItem(list.id, item.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {purchased.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">Achetés</p>
                        <div className="space-y-2">
                          {purchased.map((item) => {
                            const actual = item.actual_amount ?? item.estimated_amount;
                            const diff = actual - item.estimated_amount;
                            const diffCls = diff > 0 ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-slate-500";
                            const diffLabel = diff > 0 ? `+${formatCFA(diff)}` : diff < 0 ? formatCFA(diff) : "0";
                            const cat = wishCategories.find((c) => c.id === (item.category || "misc")) ?? { label: item.category || "Divers", icon: "heart", color: "#EC4899" };
                            return (
                              <div key={item.id} className="rounded-lg p-3 glass border border-white/5 opacity-90">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium text-slate-400 truncate">{item.name}</p>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                                        <Icon name={cat.icon} size={10} />
                                        {cat.label}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px]">
                                      <span className="text-slate-500">Prévu : <span className="font-mono text-slate-400">{formatCFA(item.estimated_amount)}</span></span>
                                      <span className="text-slate-500">Réel : <span className="font-mono text-emerald-400">{formatCFA(actual)}</span></span>
                                      <span className={diffCls}>Écart : <span className="font-mono">{diffLabel}</span></span>
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-1">Acheté le {formatDateTime(item.purchased_at)}</p>
                                  </div>
                                  <button onClick={() => handleDeleteItem(list.id, item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 shrink-0">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {items.length === 0 && (
                      <p className="text-center text-slate-500 text-sm py-4">
                        Aucun article. <button onClick={() => router.push(getModalHref({ type: "new-wish-item", returnTo: "/wishes", listId: String(list.id), listName: list.name }))} className="text-pink-400 hover:underline">Ajouter</button>
                      </p>
                    )}

                    {(pending.length > 0 || purchased.length > 0) && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5 text-xs">
                        <span className="text-slate-500">Total prévu : <span className="font-mono text-slate-400">{formatCFA(totalEst)}</span></span>
                        {purchased.length > 0 && (
                          <span className="text-slate-500">Total réel : <span className="font-mono text-emerald-400">{formatCFA(totalActual)}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Modifier liste */}
      {editingList && (
        <EditListModal
          list={editingList}
          onSave={(updates) => handleUpdateList(editingList.id, updates)}
          onCancel={() => setEditingList(null)}
        />
      )}

      {/* Modal Modifier article */}
      {editingItem && (
        <EditWishItemModal
          item={editingItem}
          wishCategories={wishCategories}
          onSave={(updates) => handleUpdateItem(editingItem.list_id, editingItem.id, updates)}
          onCancel={() => setEditingItem(null)}
          onCaptureGeolocation={captureGeolocation}
        />
      )}
      </div>
    </div>
  );
}

function EditListModal({
  list,
  onSave,
  onCancel,
}: {
  list: WishList;
  onSave: (updates: Partial<WishList>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(list.name);
  const [scheduled_date, setScheduledDate] = useState(list.scheduled_date);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onCancel}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Pencil size={18} className="text-pink-400" />
            Modifier la liste
          </h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-white p-1"><X size={20} /></button>
        </div>
        <div className="grid gap-4">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Nom *</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Date prévue *</label>
            <input type="date" className="input-field" value={scheduled_date} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium">Annuler</button>
          <button onClick={() => onSave({ name, scheduled_date })} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
            <Check size={16} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function EditWishItemModal({
  item,
  wishCategories,
  onSave,
  onCancel,
  onCaptureGeolocation,
}: {
  item: WishListItem;
  wishCategories: WishCategory[];
  onSave: (updates: Partial<WishListItem>) => void;
  onCancel: () => void;
  onCaptureGeolocation: (cb: (lat: number, lng: number) => void) => void;
}) {
  const [name, setName] = useState(item.name);
  const [target_date, setTargetDate] = useState(item.target_date);
  const [category, setCategory] = useState(item.category || "misc");
  const [estimated_amount, setEstimatedAmount] = useState(String(item.estimated_amount));
  const [notes, setNotes] = useState(item.notes || "");
  const [shop_name, setShopName] = useState(item.shop_name || "");
  const [shop_phone, setShopPhone] = useState(item.shop_phone || "");
  const [shop_address, setShopAddress] = useState(item.shop_address || "");
  const [shop_lat, setShopLat] = useState(item.shop_lat != null ? String(item.shop_lat) : "");
  const [shop_lng, setShopLng] = useState(item.shop_lng != null ? String(item.shop_lng) : "");

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onCancel}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl popup-panel p-6 sm:p-8 max-h-[90dvh] overflow-y-auto shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Pencil size={18} className="text-pink-400" />
            Modifier l&apos;article
          </h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-white p-1"><X size={20} /></button>
        </div>
        <div className="grid gap-4">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Article *</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Date prévisionnelle d&apos;achat *</label>
            <input type="date" className="input-field" value={target_date} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie *</label>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {wishCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Budget prévu (FCFA) *</label>
            <input type="number" className="input-field font-mono" value={estimated_amount} onChange={(e) => setEstimatedAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Notes</label>
            <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="border-t border-white/10 pt-4 mt-2">
            <p className="text-xs font-medium text-slate-400 mb-3">Boutique cible</p>
            <div className="grid gap-3">
              <div>
                <label className="text-[10px] text-neutral-500 mb-1 block">Nom de la boutique</label>
                <input className="input-field" value={shop_name} onChange={(e) => setShopName(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 mb-1 block">Téléphone</label>
                <input type="tel" className="input-field" value={shop_phone} onChange={(e) => setShopPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 mb-1 block">Adresse</label>
                <input className="input-field" value={shop_address} onChange={(e) => setShopAddress(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-neutral-500 mb-1 block">Latitude</label>
                  <input type="number" step="any" className="input-field font-mono" value={shop_lat} onChange={(e) => setShopLat(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-neutral-500 mb-1 block">Longitude</label>
                  <input type="number" step="any" className="input-field font-mono" value={shop_lng} onChange={(e) => setShopLng(e.target.value)} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCaptureGeolocation((lat, lng) => { setShopLat(String(lat)); setShopLng(String(lng)); })}
                className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
              >
                <MapPin size={12} /> Utiliser ma position actuelle
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium">Annuler</button>
          <button
            onClick={() =>
              onSave({
                name,
                target_date,
                category,
                estimated_amount: Number(estimated_amount) || 0,
                notes,
                shop_name: shop_name || null,
                shop_phone: shop_phone || null,
                shop_address: shop_address || null,
                shop_lat: shop_lat ? Number(shop_lat) : null,
                shop_lng: shop_lng ? Number(shop_lng) : null,
              })
            }
            className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Check size={16} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
