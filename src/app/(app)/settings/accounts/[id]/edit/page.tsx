"use client";

import AccountForm from "@/components/accounts/AccountForm";
import { useParams } from "next/navigation";

export default function EditAccountPage() {
  const params = useParams();
  const raw = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const id = parseInt(raw, 10);

  if (!raw || Number.isNaN(id)) {
    return (
      <div className="px-4 py-12 text-center text-neutral-500 text-sm">Compte invalide</div>
    );
  }

  return <AccountForm editAccountId={id} />;
}
