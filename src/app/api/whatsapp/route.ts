import { after, NextResponse, type NextRequest } from "next/server";

import { atender, leerMensajes } from "@/lib/bot";
import { configWhatsapp, firmaValida, tokenVerificacion } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * La dirección que se le da a Meta para que mande acá los mensajes del
 * WhatsApp del bot.
 *
 * GET: Meta la prueba una vez, al configurarla, con la palabra de
 * verificación que muestra el panel (WhatsApp → Para pegar en Meta).
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const esperado = tokenVerificacion();
  if (params.get("hub.mode") === "subscribe" && esperado && params.get("hub.verify_token") === esperado) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("No autorizado", { status: 403 });
}

/**
 * POST: cada mensaje que llega. Se comprueba la firma de Meta, se contesta
 * enseguida (Meta reintenta si tardamos) y el mensaje se atiende después.
 */
export async function POST(request: NextRequest) {
  const { appSecret, completa } = configWhatsapp();
  if (!completa || !appSecret) return new NextResponse("Bot sin configurar", { status: 503 });

  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Firma inválida", { status: 401 });
  }

  let aviso: unknown;
  try {
    aviso = JSON.parse(cuerpo);
  } catch {
    return new NextResponse("JSON inválido", { status: 400 });
  }

  const mensajes = leerMensajes(aviso);
  if (mensajes.length > 0) {
    after(async () => {
      for (const mensaje of mensajes) {
        try {
          await atender(mensaje);
        } catch (error) {
          console.error("[bot] error atendiendo un mensaje:", (error as Error).message);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
