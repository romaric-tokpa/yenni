import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getAccountById, updateAccount, deleteAccount } from "@/lib/db";
import { apiErrorResponse } from "@/lib/apiError";
import { accountKindAllowsLogo } from "@/lib/accountLogoShared";
import { resolveAccountLogoInput } from "@/lib/accountLogoParse";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    const body = await req.json();
    const existing = await getAccountById(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.kind !== undefined) updates.kind = String(body.kind);
    if (body.subtype !== undefined) updates.subtype = body.subtype != null ? String(body.subtype).trim() : "";
    if (body.institution_name !== undefined) {
      updates.institution_name =
        typeof body.institution_name === "string" ? String(body.institution_name).trim() : "";
    }
    if (body.notes !== undefined) updates.notes = String(body.notes ?? "");
    if (body.icon !== undefined) updates.icon = String(body.icon);
    if (body.color !== undefined) updates.color = String(body.color);
    if (body.opening_balance !== undefined) updates.opening_balance = Math.round(Number(body.opening_balance) || 0);
    if (body.is_archived !== undefined) updates.is_archived = body.is_archived ? 1 : 0;
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order) || 0;
    if (body.unlock_vault === true) {
      updates.vault_unlocks_on = null;
    } else if (body.vault_unlocks_on !== undefined) {
      const v = body.vault_unlocks_on;
      updates.vault_unlocks_on = v == null || v === "" ? null : String(v).trim();
    }

    const nextKind = body.kind !== undefined ? String(body.kind) : existing.kind;
    if (body.kind !== undefined && nextKind !== "vault") {
      updates.vault_unlocks_on = null;
    }
    if (body.kind !== undefined && !nextKind.startsWith("bank_")) {
      updates.institution_name = "";
    }
    if (body.logo_url !== undefined) {
      const p = await resolveAccountLogoInput(body.logo_url);
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      if (p.dataUri && !accountKindAllowsLogo(nextKind)) {
        return NextResponse.json(
          { error: "Logo réservé aux comptes Mobile Money, carte prépayée ou bancaire" },
          { status: 400 },
        );
      }
      updates.logo_url = accountKindAllowsLogo(nextKind) ? p.dataUri : "";
    } else if (body.kind !== undefined && !accountKindAllowsLogo(nextKind)) {
      updates.logo_url = "";
    }

    const acc = await updateAccount(
      id,
      session.userId,
      updates as Parameters<typeof updateAccount>[2],
    );
    if (!acc) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    return NextResponse.json(acc);
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    const r = await deleteAccount(id, session.userId);
    if (!r.ok) {
      const msg =
        r.reason === "last_account"
          ? "Impossible de supprimer le dernier compte"
          : r.reason === "has_expenses" || r.reason === "has_incomes" || r.reason === "has_transfers"
            ? "Compte encore utilisé : archive-le ou réaffecte les opérations"
            : "Suppression impossible";
      return NextResponse.json({ error: msg }, { status: r.reason === "not_found" ? 404 : 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
