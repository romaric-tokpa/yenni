"use client";

import { useState, useEffect } from "react";
import { Plus, X, Check, MapPin } from "lucide-react";
import type { BudgetContextValue } from "./types";
import { WishItemPhotosEditor } from "@/components/WishItemPhotosEditor";

interface ModalNewWishItemProps {
  onClose: () => void;
  budget: BudgetContextValue;
  listId: string;
  listName: string;
}

function captureGeolocation(cb: (lat: number, lng: number) => void) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => cb(p.coords.latitude, p.coords.longitude),
    () => {}
  );
}

export default function ModalNewWishItem({ onClose, budget, listId, listName }: ModalNewWishItemProps) {
  const { config, showToast } = budget;
  const wishCategories = (config.wishCategories ?? config.categories).length > 0
    ? (config.wishCategories ?? config.categories)
    : [{ id: "misc", label: "Divers", icon: "heart", color: "#EC4899" }];
  const defaultCategory = wishCategories[0]?.id || "misc";
  const now = new Date();
  const [form, setForm] = useState({
    name: "",
    target_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    estimated_amount: "",
    category: defaultCategory,
    notes: "",
    shop_name: "",
    shop_phone: "",
    shop_address: "",
    shop_lat: "" as string | number,
    shop_lng: "" as string | number,
  });
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    setForm((f) => ({ ...f, category: defaultCategory }));
  }, [defaultCategory]);

  const handleSubmit = async () => {
    if (!listId || !form.name || !form.target_date || form.estimated_amount === "" || Number(form.estimated_amount) < 0) {
      showToast("Nom, date prévue et budget requis", "error");
      return;
    }
    try {
      const r = await fetch(`/api/wish-lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          target_date: form.target_date,
          estimated_amount: Number(form.estimated_amount),
          category: form.category,
          notes: form.notes,
          photos,
          shop_name: form.shop_name || undefined,
          shop_phone: form.shop_phone || undefined,
          shop_address: form.shop_address || undefined,
          shop_lat: form.shop_lat ? Number(form.shop_lat) : undefined,
          shop_lng: form.shop_lng ? Number(form.shop_lng) : undefined,
        }),
      });
      if (r.ok) {
        showToast("Envie ajoutée !");
        onClose();
      } else {
        showToast("Erreur", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
          <Plus size={18} className="text-pink-400" /> Nouvelle envie — {listName || "Liste"}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={20} /></button>
      </div>
      <div className="space-y-5">
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Produit</h3>
          <div className="grid gap-4">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Titre de l&apos;article *</label>
              <input className="input-field" placeholder="Ex : Casque Bluetooth, Robe…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Date prévue *</label>
                <input type="date" className="input-field" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Prix cible (FCFA) *</label>
                <input
                  type="number"
                  className="input-field font-mono"
                  placeholder="0"
                  value={form.estimated_amount}
                  onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Catégorie *</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {wishCategories.map((c: { id: string; label: string }) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Description (optionnel)</label>
              <textarea
                className="input-field min-h-[88px] resize-y py-3"
                placeholder="Détails, modèle, couleur, lien mémorisé…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Photos de l&apos;article</label>
              <WishItemPhotosEditor photos={photos} onChange={setPhotos} idPrefix="new-wish-photo" />
            </div>
          </div>
        </section>
        <section className="border-t border-white/10 pt-4 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vendeur (optionnel)</h3>
          <p className="text-[10px] text-neutral-600 leading-relaxed">
            Affichés comme sur une fiche e-commerce : nom du vendeur / boutique et numéro pour appeler ou écrire.
          </p>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Nom du vendeur ou de la boutique</label>
              <input
                className="input-field"
                placeholder="Ex : Boutique Hassan, Marché Médina…"
                value={form.shop_name}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Numéro joignable</label>
              <input
                type="tel"
                className="input-field"
                placeholder="+225 07 00 00 00 00"
                value={form.shop_phone}
                onChange={(e) => setForm({ ...form, shop_phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Adresse ou lieu</label>
              <input
                className="input-field"
                placeholder="Adresse, quartier…"
                value={form.shop_address}
                onChange={(e) => setForm({ ...form, shop_address: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => captureGeolocation((lat, lng) => setForm((f) => ({ ...f, shop_lat: lat, shop_lng: lng })))}
              className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
            >
              <MapPin size={12} /> Utiliser ma position actuelle
            </button>
          </div>
        </section>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
        <button onClick={onClose} className="flex-1 min-h-[44px] py-3 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-sm font-medium transition-colors">Annuler</button>
        <button onClick={handleSubmit} className="btn-primary flex-1 min-h-[44px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
          <Check size={16} /> Enregistrer
        </button>
      </div>
    </>
  );
}
