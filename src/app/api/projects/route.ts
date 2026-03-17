import { NextRequest, NextResponse } from "next/server";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
} from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(await getProjects());
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.target_amount) {
      return NextResponse.json(
        { error: "Nom et montant cible requis" },
        { status: 400 }
      );
    }
    const project = await addProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id)
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const project = updateProject(body.id, body);
    return project
      ? NextResponse.json(project)
      : NextResponse.json({ error: "Non trouvé" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
