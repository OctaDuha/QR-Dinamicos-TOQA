import { NextResponse, type NextRequest } from "next/server";

import { enviarRespaldoPorMail } from "@/lib/respaldo-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel llama a esto una vez por dia, pero el mail sale una vez por mes:
 * la ruta mira cuando fue el ultimo y decide. Se hace asi, y no con un cron
 * mensual, porque el plan gratuito de Vercel permite pocas tareas y las
 * corre a diario; ademas, si un dia fallara, al siguiente se reintenta solo
 * en vez de esperar otro mes.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }

  const resultado = await enviarRespaldoPorMail();

  if (!resultado.ok && resultado.error === "sin configurar") {
    return NextResponse.json({ ok: true, enviado: false, motivo: "sin configurar" });
  }

  return NextResponse.json(resultado, {
    status: resultado.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
