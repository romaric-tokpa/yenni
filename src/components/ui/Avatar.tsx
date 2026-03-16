"use client";
import { useState } from "react";
import { getAvatarSrc } from "@/lib/constants";

interface AvatarProps {
  avatarPath: string | null;
  firstName: string;
  lastName: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-10 h-10 lg:w-11 lg:h-11 text-sm",
};

export default function Avatar({ avatarPath, firstName, lastName, className = "", size = "md" }: AvatarProps) {
  const [error, setError] = useState(false);
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;
  const src = getAvatarSrc(avatarPath);

  if (avatarPath && src && !error) {
    return (
      <img
        src={src}
        alt=""
        className={`rounded-full object-cover ring-2 ring-emerald-500/40 shrink-0 ${sizeClasses[size]} ${className}`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold ring-2 ring-emerald-500/40 shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
