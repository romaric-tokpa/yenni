import { redirect } from "next/navigation";

/** Ancienne URL : tout conduit vers Transactions. */
export default function ExpensesRedirectPage() {
  redirect("/transactions");
}
