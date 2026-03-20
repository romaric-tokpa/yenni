import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/apiError";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  getAccountById,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getProjects());
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.name || body.target_amount == null) {
      return NextResponse.json(
        { error: "Nom et montant cible requis" },
        { status: 400 },
      );
    }
    const accountId = body.account_id != null ? Number(body.account_id) : NaN;
    if (!Number.isFinite(accountId)) {
      return NextResponse.json(
        { error: "Choisis le compte d’épargne du projet" },
        { status: 400 },
      );
    }
    const acc = await getAccountById(accountId, session.userId);
    if (!acc || acc.is_archived) {
      return NextResponse.json({ error: "Compte invalide ou archivé" }, { status: 400 });
    }
    const project = await addProject({
      ...body,
      target_amount: Number(body.target_amount),
      saved_amount: body.saved_amount ?? 0,
      account_id: accountId,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.id)
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    if (body.account_id != null) {
      const accountId = Number(body.account_id);
      if (!Number.isFinite(accountId)) {
        return NextResponse.json({ error: "Compte invalide" }, { status: 400 });
      }
      const acc = await getAccountById(accountId, session.userId);
      if (!acc || acc.is_archived) {
        return NextResponse.json({ error: "Compte invalide ou archivé" }, { status: 400 });
      }
    }
    const project = await updateProject(body.id, body);
    return project
      ? NextResponse.json(project)
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id)
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const ok = await deleteProject(parseInt(id));
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(apiErrorResponse(err), { status: 500 });
  }
}
