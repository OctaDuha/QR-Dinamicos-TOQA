import { NextResponse } from "next/server";

import { formatQrCode, parseQrId, qrPngBuffer, siteUrl } from "@/lib/qr";

// Publico a proposito: el PNG solo codifica la URL /r/[id], que ya es publica.
// Asi Canva (y cualquier herramienta de creacion masiva) puede descargarlo.
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = parseQrId(rawId);

  if (id === null) {
    return new NextResponse("QR inválido", { status: 400 });
  }

  const png = await qrPngBuffer(id, siteUrl(), 1024);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="qr-${formatQrCode(id)}.png"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
