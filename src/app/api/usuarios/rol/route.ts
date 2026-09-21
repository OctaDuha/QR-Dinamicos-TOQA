import { NextResponse, type NextRequest } from "next/server";

import { requireDueno } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cambia el rol de otro usuario. Sólo el dueño. */
export async function POST(request: NextRequest) {
  const { sesion, denied } = await requireDueno();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { id?: string; rol?: string };
  const rol = body.rol === "dueno" ? "dueno" : "empleado";

  if (!body.id) {
    return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
  }

  // Nadie se cambia el rol a si mismo: bajarse dejaria la cuenta sin dueño.
  if (body.id === sesion.userId) {
    return NextResponse.json({ error: "No podés cambiarte el rol a vos mismo." }, { status: 400 });
  }

  const { data, error } = await sesion.supabase
    .from("perfiles")
    .update({ rol })
    .eq("id", body.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if ((data?.length ?? 0) === 0) {
    return NextResponse.json({ error: "No se pudo cambiar el rol." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, rol });
}
