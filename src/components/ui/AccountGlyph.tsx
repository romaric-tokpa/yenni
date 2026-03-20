"use client";

import Icon from "./Icon";
import type { Account } from "@/lib/types";

type Props = {
  account: Pick<Account, "icon" | "color" | "logo_url">;
  /** Taille côté icône Lucide (le logo image est un peu plus grand pour rester lisible) */
  size?: number;
  className?: string;
};

export default function AccountGlyph({ account, size = 20, className = "" }: Props) {
  const logo = account.logo_url?.trim();
  if (logo && logo.startsWith("data:image/")) {
    const px = Math.round(size * 2);
    return (
      <img
        src={logo}
        alt=""
        width={px}
        height={px}
        className={`rounded-xl object-contain bg-white/[0.06] ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }
  return <Icon name={account.icon || "wallet"} size={size} className={className} style={{ color: account.color || undefined }} />;
}
