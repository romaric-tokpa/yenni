"use client";

import { useState } from "react";
import { getModalHref } from "@/lib/modal";
import { useRouter } from "next/navigation";
import { formatCFA } from "@/lib/constants";
import { parseWishItemPhotos } from "@/lib/wishPhotos";
import type { WishListItem } from "@/lib/types";
import Icon from "./ui/Icon";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  MapPin,
  Pencil,
  Phone,
  Store,
  Trash2,
} from "lucide-react";

type CatDisplay = { label: string; icon: string; color: string };

function PhotoCarousel({ urls, alt }: { urls: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
        <ImageIcon className="h-14 w-14 text-neutral-600" strokeWidth={1} aria-hidden />
      </div>
    );
  }
  const safe = Math.min(idx, urls.length - 1);
  const go = (d: number) => setIdx((i) => (i + d + urls.length) % urls.length);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40 group">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URLs dynamiques */}
      <img src={urls[safe]} alt={alt} className="h-full w-full object-contain sm:object-cover" />
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 sm:opacity-100"
            aria-label="Photo précédente"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 sm:opacity-100"
            aria-label="Photo suivante"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
                className={`h-1.5 rounded-full transition-all ${i === safe ? "w-5 bg-pink-400" : "w-1.5 bg-white/35"}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WishItemProductCardPending({
  item,
  cat,
  listId,
  dueLabel,
  mapsUrl,
  isHighlighted,
  onEdit,
  onDelete,
}: {
  item: WishListItem;
  cat: CatDisplay;
  listId: number;
  dueLabel: { text: string; cls: string };
  mapsUrl: string | null;
  isHighlighted: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const photos = parseWishItemPhotos(item);
  const hasVendor = !!(item.shop_name?.trim() || item.shop_phone?.trim());

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition-shadow ${
        isHighlighted
          ? "border-pink-500/50 bg-pink-500/[0.08] shadow-[0_0_32px_rgba(236,72,153,0.12)]"
          : "border-white/[0.08] bg-[var(--bg-elevated)]/80 shadow-lg shadow-black/20"
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full shrink-0 sm:w-[min(44%,280px)]">
          <PhotoCarousel urls={photos} alt={item.name} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug text-neutral-100 sm:text-lg">{item.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                >
                  <Icon name={cat.icon} size={11} />
                  {cat.label}
                </span>
                <span className={`text-[11px] font-medium ${dueLabel.cls}`}>{dueLabel.text}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Prix cible</p>
              <p className="font-mono text-xl font-bold text-pink-400 tabular-nums">{formatCFA(item.estimated_amount)}</p>
            </div>
          </div>

          {item.notes?.trim() && (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-neutral-500">{item.notes.trim()}</p>
          )}

          <p className="mt-2 text-[11px] text-neutral-600">
            Achat prévu le{" "}
            <span className="text-neutral-400">
              {new Date(item.target_date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </p>

          {hasVendor && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Vendeur</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {item.shop_name?.trim() && (
                    <p className="flex items-center gap-2 font-medium text-neutral-200">
                      <Store size={16} className="shrink-0 text-pink-400/90" aria-hidden />
                      <span className="truncate">{item.shop_name.trim()}</span>
                    </p>
                  )}
                  {item.shop_phone?.trim() && (
                    <a
                      href={`tel:${item.shop_phone.replace(/\s/g, "")}`}
                      className="mt-1.5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      <Phone size={16} className="shrink-0" aria-hidden />
                      {item.shop_phone.trim()}
                    </a>
                  )}
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-pink-300 hover:bg-white/[0.07] sm:mt-0"
                  >
                    <MapPin size={14} />
                    Carte
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() =>
                router.push(getModalHref({ type: "purchase-wish", returnTo: "/wishes", listId: String(listId), itemId: String(item.id) }))
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30"
            >
              <Check size={16} strokeWidth={2.5} />
              Acheté
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl border border-white/10 p-2.5 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Modifier"
            >
              <Pencil size={18} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl border border-white/10 p-2.5 text-neutral-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
              aria-label="Supprimer"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function WishItemProductCardPurchased({
  item,
  cat,
  formatDateTime,
  onDelete,
}: {
  item: WishListItem;
  cat: CatDisplay;
  formatDateTime: (iso: string | null) => string;
  onDelete: () => void;
}) {
  const actual = item.actual_amount ?? item.estimated_amount;
  const diff = actual - item.estimated_amount;
  const diffCls = diff > 0 ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-slate-500";
  const diffLabel = diff > 0 ? `+${formatCFA(diff)}` : diff < 0 ? formatCFA(diff) : "0";
  const photos = parseWishItemPhotos(item);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] opacity-[0.97]">
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-28 w-full shrink-0 sm:h-auto sm:w-32">
          {photos.length > 0 ? (
            <div className="flex h-full w-full overflow-x-auto">
              {photos.slice(0, 3).map((url, i) => (
                <div key={i} className="relative h-28 min-w-[40%] flex-1 border-r border-white/5 last:border-r-0 sm:min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/[0.04]">
              <ImageIcon className="h-8 w-8 text-neutral-600" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-neutral-300">{item.name}</h3>
              <span
                className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
              >
                <Icon name={cat.icon} size={10} />
                {cat.label}
              </span>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
              aria-label="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span className="text-neutral-500">
              Prévu : <span className="font-mono text-neutral-400">{formatCFA(item.estimated_amount)}</span>
            </span>
            <span className="text-neutral-500">
              Réel : <span className="font-mono text-emerald-400">{formatCFA(actual)}</span>
            </span>
            <span className={diffCls}>
              Écart : <span className="font-mono">{diffLabel}</span>
            </span>
          </div>
          {(item.shop_name || item.shop_phone) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-1 text-[10px] text-neutral-500">
              {item.shop_name?.trim() && (
                <span className="flex items-center gap-1">
                  <Store size={11} />
                  {item.shop_name.trim()}
                </span>
              )}
              {item.shop_phone?.trim() && (
                <a href={`tel:${item.shop_phone.replace(/\s/g, "")}`} className="text-emerald-500/90 hover:underline">
                  {item.shop_phone.trim()}
                </a>
              )}
            </p>
          )}
          <p className="mt-1 text-[9px] text-neutral-600">Acheté le {formatDateTime(item.purchased_at)}</p>
        </div>
      </div>
    </article>
  );
}
