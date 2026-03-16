"use client";
import { CheckCircle, XCircle, Info } from "lucide-react";

export default function Toast({
  message,
  type,
}: {
  message: string;
  type: string;
}) {
  return (
    <div
      className="toast-animate fixed top-5 right-5 z-50 px-6 py-3 rounded-xl font-medium text-sm text-white shadow-2xl flex items-center gap-2"
      style={{
        background:
          type === "success"
            ? "linear-gradient(135deg,#059669,#10b981)"
            : type === "error"
              ? "linear-gradient(135deg,#dc2626,#ef4444)"
              : "linear-gradient(135deg,#6366f1,#8b5cf6)",
      }}
    >
      {type === "success" ? (
        <CheckCircle size={16} />
      ) : type === "error" ? (
        <XCircle size={16} />
      ) : (
        <Info size={16} />
      )}{" "}
      {message}
    </div>
  );
}
