import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { leerSerieRango } from "@/lib/estadisticas";
import { leerPedido, mensajeErrorSerie, slug } from "@/lib/estadisticas-pedido";
import { dibujarReporte, sumarSeries, type TotalPlaca } from "@/lib/reporte-imagen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** El reporte en imagen de una placa (?qr=) o de un cliente (?cliente=), para descargar. */
export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const leido = await leerPedido(supabase, request.nextUrl.searchParams);
  if ("error" in leido) return new NextResponse(leido.error, { status: leido.status });
  const pedido = leido.pedido;

  // La serie de cada placa, con el mismo agrupado; después se suman.
  const series: Awaited<ReturnType<typeof leerSerieRango>>["data"][] = [];
  const porPlaca: TotalPlaca[] = [];
  for (let i = 0; i < pedido.placas.length; i += 8) {
    const tanda = pedido.placas.slice(i, i + 8);
    const leidas = await Promise.all(tanda.map((placa) => leerSerieRango(supabase, placa.id, pedido.rango)));
    for (const [j, serie] of leidas.entries()) {
      if (serie.error) {
        const { texto, status } = mensajeErrorSerie(serie.error);
        return new NextResponse(texto, { status });
      }
      series.push(serie.data);
      porPlaca.push({
        ...tanda[j],
        qr: serie.data.reduce((t, p) => t + (p.qr ?? 0), 0),
        nfc: serie.data.reduce((t, p) => t + (p.nfc ?? 0), 0),
      });
    }
  }

  const archivo = `reporte-${slug(pedido.nombre)}-${pedido.rango.desde}-al-${pedido.rango.hasta}.png`;
  const cantidad = pedido.placas.length;

  return dibujarReporte(
    {
      titulo: pedido.esCliente ? pedido.nombre : `Placa ${pedido.nombre}`,
      subtitulo: pedido.esCliente ? (cantidad === 1 ? "1 placa" : `${cantidad} placas`) : (pedido.etiqueta ?? ""),
      esCliente: pedido.esCliente,
      rango: pedido.rango,
      puntos: sumarSeries(series),
      porPlaca,
    },
    { "Content-Disposition": `attachment; filename="${archivo}"`, "Cache-Control": "no-store" },
  );
}
