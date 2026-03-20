"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const AccountTransactionsView = dynamic(() => import("@/components/accounts/AccountTransactionsView"), {
  loading: () => <div className="animate-pulse h-64 rounded-2xl bg-white/5 mx-4 mt-8" />,
});

export default function AccountMovementsPage() {
  const params = useParams();
  const raw = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const id = parseInt(raw, 10);

  if (!raw || Number.isNaN(id)) {
    return (
      <div className="px-4 py-12 text-center text-neutral-500 text-sm">Compte invalide</div>
    );
  }

  return <AccountTransactionsView accountId={id} />;
}
