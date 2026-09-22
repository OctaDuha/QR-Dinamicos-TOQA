import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { enviarRespaldoPorMail } from "@/lib/respaldo-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mandarse la copia por mail ahora, a mano. Sirve para probar que llega. */
export async function POST() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const resultado = await enviarRespaldoPorMail(true);

  if (!resultado.ok) {
    return NextResponse.json(
      {
        error:
          resultado.error === "sin configurar"
            ? "Falta configurar RESEND_API_KEY y RESPALDO_EMAIL en Vercel."
            : resultado.error,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(resultado);
}
