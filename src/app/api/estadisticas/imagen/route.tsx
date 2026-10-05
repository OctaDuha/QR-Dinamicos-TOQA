import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/canva-guard";
import { fechaCorta, leerSerieRango } from "@/lib/estadisticas";
import { leerPedido, mensajeErrorSerie, slug, type Pedido } from "@/lib/estadisticas-pedido";
import { formatQrCode } from "@/lib/qr";
import type { ScanBucket } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El reporte para mandarle al cliente: una imagen con los totales, el
 * gráfico QR/NFC y, si es un cliente, cuánto escaneó cada placa. Imagen y no
 * PDF porque WhatsApp la muestra directo en el chat, sin abrir nada.
 */

// Fondo claro: se va a ver en el celular de cualquiera, no en el panel.
const C = {
  fondo: "#ffffff",
  superficie: "#f6f6f4",
  linea: "#e4e3df",
  tinta: "#1b1d22",
  tinta2: "#4b4f58",
  tinta3: "#7b7f88",
  marca: "#e0721f",
  qr: "#e0721f", // los mismos colores del panel, validados también sobre blanco
  nfc: "#5e8de0",
};

const ANCHO = 1080;
const MARGEN = 72;
const ALTO_GRAFICO = 320;
const MAX_FILAS_TABLA = 8;

const fuentes = Promise.all([
  readFile(join(process.cwd(), "src/assets/fuentes/noto-sans-400.woff")),
  readFile(join(process.cwd(), "src/assets/fuentes/noto-sans-700.woff")),
]);

const numero = (n: number) => new Intl.NumberFormat("es-AR").format(n);
const decimal = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);

type Punto = { inicio: string; qr: number; nfc: number };

export async function GET(request: NextRequest) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const leido = await leerPedido(supabase, request.nextUrl.searchParams);
  if ("error" in leido) return new NextResponse(leido.error, { status: leido.status });
  const pedido = leido.pedido;

  // La serie de cada placa, con el mismo agrupado, y la suma de todas.
  const porPlaca: { id: number; label: string | null; qr: number; nfc: number }[] = [];
  const suma = new Map<string, Punto>();
  for (let i = 0; i < pedido.placas.length; i += 8) {
    const tanda = pedido.placas.slice(i, i + 8);
    const series = await Promise.all(tanda.map((placa) => leerSerieRango(supabase, placa.id, pedido.rango)));
    for (const [j, serie] of series.entries()) {
      if (serie.error) {
        const { texto, status } = mensajeErrorSerie(serie.error);
        return new NextResponse(texto, { status });
      }
      let qr = 0;
      let nfc = 0;
      for (const p of serie.data) {
        const anterior = suma.get(p.bucket_start) ?? { inicio: p.bucket_start, qr: 0, nfc: 0 };
        anterior.qr += p.qr ?? 0;
        anterior.nfc += p.nfc ?? 0;
        suma.set(p.bucket_start, anterior);
        qr += p.qr ?? 0;
        nfc += p.nfc ?? 0;
      }
      porPlaca.push({ ...tanda[j], qr, nfc });
    }
  }

  const puntos = [...suma.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const filasTabla = pedido.esCliente ? Math.min(porPlaca.length, MAX_FILAS_TABLA) : 0;
  // Lo fijo (marca, título, números, gráfico y pie) más lo que cambia: las
  // dos líneas de una placa, o la tabla de un cliente según cuántas placas.
  const alto =
    1130 + (pedido.esCliente ? 120 + filasTabla * 58 + (porPlaca.length > MAX_FILAS_TABLA ? 50 : 0) : 100);

  const [normal, negrita] = await fuentes;
  const archivo = `reporte-${slug(pedido.nombre)}-${pedido.rango.desde}-al-${pedido.rango.hasta}.png`;

  return new ImageResponse(<Reporte pedido={pedido} puntos={puntos} porPlaca={porPlaca} />, {
    width: ANCHO,
    height: alto,
    fonts: [
      { name: "Noto Sans", data: normal, weight: 400, style: "normal" },
      { name: "Noto Sans", data: negrita, weight: 700, style: "normal" },
    ],
    headers: {
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}

function Reporte({
  pedido,
  puntos,
  porPlaca,
}: {
  pedido: Pedido;
  puntos: Punto[];
  porPlaca: { id: number; label: string | null; qr: number; nfc: number }[];
}) {
  const qr = puntos.reduce((t, p) => t + p.qr, 0);
  const nfc = puntos.reduce((t, p) => t + p.nfc, 0);
  const total = qr + nfc;
  const { desde, hasta, bucket } = pedido.rango;
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  const pico = puntos.reduce<Punto | null>((max, p) => (!max || p.qr + p.nfc > max.qr + max.nfc ? p : max), null);

  const titulo = pedido.esCliente ? pedido.nombre : `Placa ${pedido.nombre}`;
  const subtitulo = pedido.esCliente
    ? `${pedido.placas.length === 1 ? "1 placa" : `${pedido.placas.length} placas`}`
    : (pedido.etiqueta ?? "");

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.fondo,
        padding: MARGEN,
        fontFamily: "Noto Sans",
        color: C.tinta,
      }}
    >
      {/* Marca */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 8 }}>
          TOQA<span style={{ color: C.marca }}>.</span>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: C.tinta3 }}>Reporte de escaneos</div>
      </div>

      {/* Título */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 700, lineHeight: 1.1 }}>{titulo}</div>
        <div style={{ display: "flex", fontSize: 28, color: C.tinta2, marginTop: 10 }}>
          {[subtitulo, `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`].filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* Números */}
      <div style={{ display: "flex", marginTop: 40, gap: 20 }}>
        <Cifra titulo="Escaneos en total" valor={numero(total)} grande />
        <Cifra titulo="Por QR" valor={numero(qr)} pie={porcentaje(qr, total)} color={C.qr} />
        <Cifra titulo="Por NFC" valor={numero(nfc)} pie={porcentaje(nfc, total)} color={C.nfc} />
      </div>

      {/* Gráfico */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 28,
          padding: 28,
          borderRadius: 20,
          background: C.superficie,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>Escaneos por {NOMBRE[bucket]}</div>
          <div style={{ display: "flex", gap: 24, fontSize: 22, color: C.tinta2 }}>
            <Muestra color={C.qr} texto="QR" />
            <Muestra color={C.nfc} texto="NFC" />
          </div>
        </div>
        <Grafico puntos={puntos} bucket={bucket} />
      </div>

      {/* Lo que conviene contar en palabras */}
      {!pedido.esCliente ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, fontSize: 24, color: C.tinta2, gap: 6 }}>
          {total > 0 && pico ? (
            <div style={{ display: "flex" }}>
              {`${MEJOR[bucket]}: ${etiquetaLarga(pico.inicio, bucket)}, con ${numero(pico.qr + pico.nfc)} escaneos.`}
            </div>
          ) : null}
          <div style={{ display: "flex" }}>{`Promedio: ${decimal(total / dias)} escaneos por día.`}</div>
        </div>
      ) : (
        <TablaPlacas porPlaca={porPlaca} />
      )}

      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: C.tinta3 }}>
        <div style={{ display: "flex" }}>toqaqr.com.ar</div>
        <div style={{ display: "flex" }}>QR = escaneo con la cámara · NFC = acercando el celular</div>
      </div>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  pie,
  color,
  grande = false,
}: {
  titulo: string;
  valor: string;
  pie?: string;
  color?: string;
  grande?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: grande ? 1.4 : 1,
        padding: "22px 26px",
        borderRadius: 20,
        background: C.superficie,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, color: C.tinta2 }}>
        {color ? <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: color }} /> : null}
        {titulo}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
        <div style={{ display: "flex", fontSize: grande ? 76 : 56, fontWeight: 700, lineHeight: 1.1 }}>{valor}</div>
        {pie ? <div style={{ display: "flex", fontSize: 24, color: C.tinta3 }}>{pie}</div> : null}
      </div>
    </div>
  );
}

function Muestra({ color, texto }: { color: string; texto: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: color }} />
      {texto}
    </div>
  );
}

/** Barras apiladas: QR abajo, NFC arriba, como en el panel. */
function Grafico({ puntos, bucket }: { puntos: Punto[]; bucket: ScanBucket }) {
  const ancho = ANCHO - 2 * MARGEN - 2 * 28;
  const ejeY = 56;
  const anchoBarras = ancho - ejeY;
  const maximo = Math.max(0, ...puntos.map((p) => p.qr + p.nfc));
  const tope = topeLindo(maximo);
  const marcas = [0, 1, 2, 3, 4].map((i) => (tope / 4) * i);
  const paso = anchoBarras / Math.max(puntos.length, 1);
  const separacion = Math.min(6, Math.max(2, paso * 0.25));
  const anchoBarra = Math.max(2, paso - separacion);
  const cadaCuanto = Math.max(1, Math.ceil(puntos.length / 7));
  const pico = puntos.findIndex((p) => p.qr + p.nfc === maximo);
  const alto = (v: number) => (v > 0 ? Math.max(3, (v / tope) * ALTO_GRAFICO) : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
      <div style={{ display: "flex", position: "relative", height: ALTO_GRAFICO + 34 }}>
        {/* Líneas de referencia, discretas */}
        {marcas.map((v) => (
          <div
            key={v}
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              right: 0,
              top: 34 + ALTO_GRAFICO - (v / tope) * ALTO_GRAFICO - 12,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", width: ejeY - 12, justifyContent: "flex-end", fontSize: 18, color: C.tinta3 }}>
              {numero(v)}
            </div>
            <div style={{ display: "flex", flex: 1, height: v === 0 ? 2 : 1, marginLeft: 12, background: C.linea }} />
          </div>
        ))}
        {maximo === 0 ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: ejeY,
              right: 0,
              top: 34 + ALTO_GRAFICO / 2 - 20,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "4px 16px",
                background: C.superficie,
                fontSize: 26,
                color: C.tinta3,
              }}
            >
              Sin escaneos en estas fechas
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: ejeY,
              bottom: 0,
              height: ALTO_GRAFICO + 34,
              alignItems: "flex-end",
            }}
          >
            {puntos.map((p, i) => (
              <div
                key={p.inicio}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  width: paso,
                  height: ALTO_GRAFICO + 34,
                }}
              >
                {i === pico ? (
                  <div style={{ display: "flex", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                    {numero(p.qr + p.nfc)}
                  </div>
                ) : null}
                {p.nfc > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      width: anchoBarra,
                      height: alto(p.nfc),
                      background: C.nfc,
                      borderTopLeftRadius: Math.min(4, anchoBarra / 2),
                      borderTopRightRadius: Math.min(4, anchoBarra / 2),
                    }}
                  />
                ) : null}
                {p.nfc > 0 && p.qr > 0 ? <div style={{ display: "flex", height: 2 }} /> : null}
                {p.qr > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      width: anchoBarra,
                      height: alto(p.qr),
                      background: C.qr,
                      borderTopLeftRadius: p.nfc > 0 ? 0 : Math.min(4, anchoBarra / 2),
                      borderTopRightRadius: p.nfc > 0 ? 0 : Math.min(4, anchoBarra / 2),
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Fechas, salteadas para que no se pisen */}
      <div style={{ display: "flex", marginLeft: ejeY, marginTop: 10, height: 26 }}>
        {puntos.map((p, i) => (
          <div
            key={p.inicio}
            style={{ display: "flex", width: paso, justifyContent: "center", fontSize: 18, color: C.tinta3 }}
          >
            {i % cadaCuanto === 0 ? etiquetaCorta(p.inicio, bucket) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function TablaPlacas({ porPlaca }: { porPlaca: { id: number; label: string | null; qr: number; nfc: number }[] }) {
  const ordenadas = [...porPlaca].sort((a, b) => b.qr + b.nfc - (a.qr + a.nfc) || a.id - b.id);
  const vista = ordenadas.slice(0, MAX_FILAS_TABLA);
  const resto = ordenadas.length - vista.length;
  const columna = (ancho: number, derecha = false) =>
    ({ display: "flex", width: ancho, justifyContent: derecha ? "flex-end" : "flex-start" }) as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Por placa</div>
      <div
        style={{
          display: "flex",
          fontSize: 20,
          color: C.tinta3,
          paddingBottom: 10,
          borderBottom: `2px solid ${C.linea}`,
        }}
      >
        <div style={columna(130)}>Placa</div>
        <div style={{ display: "flex", flex: 1 }}>Etiqueta</div>
        <div style={columna(130, true)}>QR</div>
        <div style={columna(130, true)}>NFC</div>
        <div style={columna(150, true)}>Total</div>
      </div>
      {vista.map((placa) => (
        <div
          key={placa.id}
          style={{
            display: "flex",
            alignItems: "center",
            height: 58,
            fontSize: 24,
            borderBottom: `1px solid ${C.linea}`,
          }}
        >
          <div style={{ ...columna(130), fontWeight: 700 }}>{formatQrCode(placa.id)}</div>
          <div style={{ display: "flex", flex: 1, color: C.tinta2, overflow: "hidden" }}>
            {recortar(placa.label ?? "—", 26)}
          </div>
          <div style={columna(130, true)}>{numero(placa.qr)}</div>
          <div style={columna(130, true)}>{numero(placa.nfc)}</div>
          <div style={{ ...columna(150, true), fontWeight: 700 }}>{numero(placa.qr + placa.nfc)}</div>
        </div>
      ))}
      {resto > 0 ? (
        <div style={{ display: "flex", marginTop: 14, fontSize: 22, color: C.tinta3 }}>
          {`Y ${resto === 1 ? "1 placa más" : `${resto} placas más`}.`}
        </div>
      ) : null}
    </div>
  );
}

const NOMBRE: Record<ScanBucket, string> = { day: "día", week: "semana", month: "mes", year: "año" };
const MEJOR: Record<ScanBucket, string> = {
  day: "El día con más escaneos",
  week: "La semana con más escaneos",
  month: "El mes con más escaneos",
  year: "El año con más escaneos",
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function partes(inicio: string) {
  const [anio, mes, dia] = inicio.slice(0, 10).split("-").map(Number);
  return { anio, mes, dia };
}

function etiquetaCorta(inicio: string, bucket: ScanBucket): string {
  const { anio, mes, dia } = partes(inicio);
  if (bucket === "year") return String(anio);
  if (bucket === "month") return `${MESES[mes - 1]} ${String(anio).slice(2)}`;
  return `${dia}/${mes}`;
}

function etiquetaLarga(inicio: string, bucket: ScanBucket): string {
  const { anio, mes, dia } = partes(inicio);
  if (bucket === "year") return String(anio);
  if (bucket === "month") return `${MESES_LARGOS[mes - 1]} de ${anio}`;
  if (bucket === "week") return `la que empezó el ${dia}/${mes}`;
  return `el ${dia}/${mes}`;
}

/**
 * Un tope redondo con cuatro rayas enteras: 7 -> 8, 23 -> 24, 206 -> 240.
 * La raya es el paso más chico de la serie 1, 1,2, 1,5, 2, 2,5, 3, 4, 5, 6, 8
 * (por 10, 100…; siempre entero)
 * que en cuatro saltos llega al máximo.
 */
function topeLindo(maximo: number): number {
  const minimo = Math.max(1, maximo / 4);
  const potencia = 10 ** Math.floor(Math.log10(minimo));
  for (const factor of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const raya = factor * potencia;
    if (raya >= minimo && Number.isInteger(raya)) return raya * 4;
  }
  return Math.ceil(minimo) * 4;
}

function porcentaje(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : "";
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}
