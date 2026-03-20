"use client";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export default function Toast({
  message,
  type,
  onDismiss,
  duration = 3500,
}: {
  message: string;
  type: string;
  onDismiss?: () => void;
  duration?: number;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
    }, duration);
    return () => clearTimeout(t);
  }, [duration]);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => onDismiss?.(), 200);
    return () => clearTimeout(t);
  }, [exiting, onDismiss]);

  const handleDismiss = () => {
    if (!exiting) setExiting(true);
  };

  const bgStyle =
    type === "success"
      ? "linear-gradient(135deg,#059669,#10b981)"
      : type === "error"
        ? "linear-gradient(135deg,#dc2626,#ef4444)"
        : "linear-gradient(135deg,#6366f1,#8b5cf6)";

  return (
    <div
      className={`fixed top-[max(1rem,env(safe-area-inset-top))] right-4 left-4 sm:left-auto sm:max-w-md z-[100] px-4 py-3.5 rounded-xl font-medium text-sm text-white shadow-2xl flex items-center gap-3 border border-white/10 ${
        exiting ? "toast-animate-out" : "toast-animate-in"
      }`}
      style={{ background: bgStyle }}
      role="alert"
    >
      {type === "success" ? (
        <CheckCircle size={18} className="shrink-0" />
      ) : type === "error" ? (
        <XCircle size={18} className="shrink-0" />
      ) : (
        <Info size={18} className="shrink-0" />
      )}
      <span className="flex-1 min-w-0">{message}</span>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
        aria-label="Fermer"
      >
        <X size={16} />
      </button>
    </div>
  );
}
