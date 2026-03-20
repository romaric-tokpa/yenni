"use client";

import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { MAX_WISH_ITEM_PHOTOS } from "@/lib/wishPhotos";
import { compressImageToDataUrl } from "@/lib/wishPhotosClient";

export function WishItemPhotosEditor({
  photos,
  onChange,
  idPrefix = "wish-photo",
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  idPrefix?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...photos];
    for (let i = 0; i < files.length && next.length < MAX_WISH_ITEM_PHOTOS; i++) {
      const f = files[i];
      if (!f || !f.type.startsWith("image/")) continue;
      try {
        const data = await compressImageToDataUrl(f);
        next.push(data);
      } catch {
        /* ignore invalid */
      }
    }
    onChange(next.slice(0, MAX_WISH_ITEM_PHOTOS));
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {photos.map((url, idx) => (
          <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500/90"
              aria-label="Retirer la photo"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < MAX_WISH_ITEM_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-[10px] font-medium text-neutral-500 transition-colors hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-300"
          >
            <Plus size={20} strokeWidth={2} aria-hidden />
            Ajouter
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        id={idPrefix}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        multiple
        className="sr-only"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <p className="text-[10px] text-neutral-600">
        Jusqu’à {MAX_WISH_ITEM_PHOTOS} photos · JPEG/PNG · redimensionnées automatiquement
      </p>
    </div>
  );
}
