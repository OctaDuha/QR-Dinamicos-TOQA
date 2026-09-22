import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { estadoRespaldo, fotosDiarias, respaldar, ultimaDescarga } from "@/lib/respaldo";
import { mailConfigurado, ultimoMail } from "@/lib/respaldo-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuándo fue la última copia. Lo mira el panel para que no falle en silencio. */
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const [estado, fotos, descarga, mail] = await Promise.all([
    estadoRespaldo(),
    fotosDiarias(),
    ultimaDescarga(),
    ultimoMail(),
  ]);

  return NextResponse.json(
    { ...estado, fotos, descarga, mail, mailConfigurado: mailConfigurado() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Guardar una copia ahora, a mano. */
export async function POST() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const resultado = await respaldar(supabase);
  if (!resultado.ok) {
    return NextResponse.json(
      {
        error:
          resultado.error === "sin configurar"
            ? "El respaldo automático no está configurado todavía."
            : resultado.error,
      },
      { status: resultado.error === "sin configurar" ? 400 : 500 },
    );
  }

  const [estado, fotos, descarga] = await Promise.all([
    estadoRespaldo(),
    fotosDiarias(),
    ultimaDescarga(),
  ]);

  // Si la copia principal salio bien pero la foto del dia no, hay que poder
  // verlo: de otro modo el panel diria "listo" y la carpeta por dia no
  // aparece nunca, sin explicacion.
  return NextResponse.json({
    ...estado,
    fotos,
    descarga,
    errorFoto: resultado.errorFoto ?? null,
  });
}
