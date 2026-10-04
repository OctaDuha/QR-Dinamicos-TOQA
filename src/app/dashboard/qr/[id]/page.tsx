import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

import { listDesigns } from "@/lib/placa-designs";
import { sesionActual } from "@/lib/roles";
import { formatQrCode, nfcTargetUrl, parseQrId, qrPngDataUrl, qrTargetUrl, siteUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { QrCode, ScanBucket, ScanSeriesPoint } from "@/lib/types";

import { CopyButton } from "../../_components/CopyButton";
import { DeleteQrForm } from "./DeleteQrForm";
import { EditQrForm } from "./EditQrForm";
import { HistorialPlaca } from "./HistorialPlaca";
import { PlacaCard } from "./PlacaCard";
import { ScanChart } from "./ScanChart";

export const dynamic = "force-dynamic";

const BUCKETS: { value: ScanBucket; label: string; window: string }[] = [
  { value: "day", label: "Por día", window: "últimos 30 días" },
  { value: "week", label: "Por semana", window: "últimas 12 semanas" },
  { value: "month", label: "Por mes", window: "últimos 12 meses" },
];

export default async function QrDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bucket?: string; desde?: string; hasta?: string }>;
}) {
  const { id: rawId } = await params;
  const { bucket: rawBucket, desde: rawDesde, hasta: rawHasta } = await searchParams;

  const id = parseQrId(rawId);
  if (id === null) notFound();

  const hoy = fechaArgentina(new Date());
  const rango = leerRango(rawDesde, rawHasta, hoy);

  const bucket: ScanBucket = rango
    ? rango.bucket
    : rawBucket === "week" || rawBucket === "month"
      ? rawBucket
      : "day";

  const supabase = await createClient();
  const sesion = await sesionActual();

  const { data: code } = await supabase
    .from("qr_codes")
    .select("id, label, destination_url, created_at, design_id")
    .eq("id", id)
    .maybeSingle<QrCode>();

  if (!code) notFound();

  const [seriesResult, totalResult, nfcResult, recentResult, pngDataUrl, designs] = await Promise.all([
    rango ? leerSerieRango(supabase, id, rango) : leerSerie(supabase, id, bucket),
    supabase.from("scans").select("id", { count: "exact", head: true }).eq("qr_id", id),
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("qr_id", id)
      .eq("via", "nfc"),
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("qr_id", id)
      .gte("scanned_at", daysAgo(30).toISOString()),
    qrPngDataUrl(id, siteUrl(), 420),
    listDesigns(supabase),
  ]);

  // Si las fechas elegidas no se pudieron leer porque falta la funcion en la
  // base, el grafico vuelve a los ultimos 30 dias y se avisa que falta.
  const faltaMigracionRango = rango !== null && seriesResult.error?.code === "PGRST202";
  const serieFinal = faltaMigracionRango ? await leerSerie(supabase, id, "day") : seriesResult;
  const series = serieFinal.data;
  const rangoActivo = faltaMigracionRango ? null : rango;
  const bucketActivo: ScanBucket = faltaMigracionRango ? "day" : bucket;
  const target = qrTargetUrl(id, siteUrl());
  const targetNfc = nfcTargetUrl(id, siteUrl());

  // Si la columna todavia no existe (falta correr la migracion) la consulta
  // falla: ahi no se muestra el desglose en vez de romper la pagina.
  const total = totalResult.count ?? 0;
  const porNfc = nfcResult.error ? null : (nfcResult.count ?? 0);
  const activeWindow = rangoActivo
    ? `del ${fechaCorta(rangoActivo.desde)} al ${fechaCorta(rangoActivo.hasta)}${
        rangoActivo.recortadoAHoy ? " (hoy)" : ""
      } · agrupado por ${NOMBRE_BUCKET[rangoActivo.bucket]}`
    : BUCKETS.find((b) => b.value === bucketActivo)!.window;

  // Lo que muestran las fechas del calendario: el rango elegido, o el que
  // corresponde al boton activo, para que se vea desde donde se arranca.
  // Si el rango no se pudo mostrar porque falta la migracion, el calendario
  // conserva lo que se eligio: no hay que volver a cargarlo despues.
  const calendarioDesde = rango?.desde ?? fechaArgentina(rangeStart(bucketActivo));
  const calendarioHasta = rango?.hasta ?? hoy;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard" className="text-sm text-ink-2 no-underline hover:underline">
          ← Volver a la lista
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            <span className="text-ink-3">#</span>
            <span className="numero-placa">{formatQrCode(code.id)}</span>
          </h1>
          {code.label ? <span className="chip">{code.label}</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="card flex flex-col items-center gap-3 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pngDataUrl}
              alt={`QR ${formatQrCode(code.id)}`}
              width={200}
              height={200}
              className="rounded-lg bg-white p-2"
            />
            <a className="btn btn-secondary w-full" href={`/api/qr/${code.id}/png`} download>
              Descargar PNG
            </a>
          </div>

          <div className="card p-5">
            <p className="label">URL fija del QR</p>
            <p className="font-mono text-xs break-all text-ink-2">{target}</p>
            <div className="mt-2 flex gap-1">
              <CopyButton value={target} />
              <a
                className="btn btn-ghost text-xs"
                href={target}
                target="_blank"
                rel="noreferrer noopener"
              >
                Probar
              </a>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Esta URL es la que va impresa. Nunca cambia, ni siquiera si cambiás el destino.
            </p>

            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--line)" }}>
              <p className="label">Para grabar en el chip NFC</p>
              <p className="font-mono text-xs break-all text-ink-2">{targetNfc}</p>
              <div className="mt-2">
                <CopyButton value={targetNfc} />
              </div>
              <p className="mt-2 text-xs text-ink-3">
                Mismo número y mismo destino que el QR, por otro camino: así los toques del chip
                se cuentan aparte de los escaneos. Grabala con NFC Tools, tocá el chip con el
                celular para comprobar que abre bien, y recién ahí bloquealo.
              </p>
            </div>
          </div>

          <div className="card grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-xs tracking-wide text-ink-3 uppercase">Total</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">{total}</p>
              {porNfc !== null && total > 0 ? (
                <p className="mt-1 text-xs text-ink-3">
                  {total - porNfc} por QR · {porNfc} por NFC
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs tracking-wide text-ink-3 uppercase">30 días</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {recentResult.count ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card p-5">
            <EditQrForm
              id={code.id}
              label={code.label}
              destinationUrl={code.destination_url}
            />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Escaneos</h2>
                <p className="text-xs text-ink-3">{activeWindow}</p>
              </div>
              <div className="flex gap-1">
                {BUCKETS.map((option) => (
                  <Link
                    key={option.value}
                    href={`/dashboard/qr/${code.id}?bucket=${option.value}`}
                    className={
                      !rangoActivo && option.value === bucketActivo
                        ? "btn btn-primary text-xs"
                        : "btn btn-ghost text-xs"
                    }
                    scroll={false}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Un formulario comun: el calendario lo pone el navegador, y al
                tocar "Ver" la pagina se recarga con las fechas en la direccion,
                asi que el rango se puede guardar o compartir como un link. */}
            <form
              action={`/dashboard/qr/${code.id}`}
              className="mb-4 flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col gap-1 text-xs text-ink-3" htmlFor="desde">
                Desde
                <input
                  id="desde"
                  type="date"
                  name="desde"
                  required
                  defaultValue={calendarioDesde}
                  className="input py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-3" htmlFor="hasta">
                Hasta
                <input
                  id="hasta"
                  type="date"
                  name="hasta"
                  required
                  defaultValue={calendarioHasta}
                  className="input py-1 text-sm"
                />
              </label>
              <button type="submit" className={rangoActivo ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}>
                Ver esas fechas
              </button>
              {faltaMigracionRango ? (
                <p className="w-full text-xs" style={{ color: "var(--danger)" }}>
                  Para elegir fechas falta correr en Supabase el archivo{" "}
                  <code>2026-10-rango-fechas.sql</code>. Mientras tanto te muestro los últimos 30
                  días.
                </p>
              ) : null}
            </form>

            {serieFinal.error ? (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                No pude leer las estadísticas: {serieFinal.error.message}
              </p>
            ) : (
              <ScanChart data={series} bucket={bucketActivo} />
            )}
          </div>

          <PlacaCard
            qrId={code.id}
            designs={designs.map((design) => ({
              id: design.id,
              name: design.name,
              qrPage: design.layout.qrPage,
            }))}
            initialDesignId={code.design_id}
          />

          {sesion?.rol === "dueno" ? <HistorialPlaca supabase={supabase} qrId={code.id} /> : null}

          {sesion?.rol === "dueno" ? (
            <div className="card p-5">
              <p className="label">Zona peligrosa</p>
              <DeleteQrForm id={code.id} code={formatQrCode(code.id)} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SerieLeida = { data: ScanSeriesPoint[]; error: { message: string; code?: string } | null };

const NOMBRE_BUCKET: Record<ScanBucket, string> = {
  day: "día",
  week: "semana",
  month: "mes",
  year: "año",
};

type Rango = { desde: string; hasta: string; bucket: ScanBucket; recortadoAHoy: boolean };

/**
 * Las fechas del calendario, ya ordenadas y con el agrupado que conviene.
 *
 * El agrupado sale del largo del rango, para que siempre se lea: un año por
 * dia serian 365 barras imposibles de mirar. Las fechas futuras se recortan a
 * hoy, porque escaneos del futuro no hay: elegir "hasta 2030" muestra todo
 * hasta hoy, que es lo que se quiere ver.
 */
function leerRango(rawDesde: string | undefined, rawHasta: string | undefined, hoy: string): Rango | null {
  // Ida y vuelta: JavaScript convierte el 30 de febrero en 2 de marzo sin
  // avisar, y la base despues lo rechazaria. Solo pasa lo que existe.
  const valida = (v: string | undefined) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const ms = Date.parse(`${v}T00:00:00Z`);
    return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === v ? v : null;
  };
  let desde = valida(rawDesde);
  let hasta = valida(rawHasta);
  if (!desde || !hasta) return null;

  const recortadoAHoy = hasta > hoy;
  if (desde > hoy) desde = hoy;
  if (hasta > hoy) hasta = hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000;
  const bucket: ScanBucket = dias <= 62 ? "day" : dias <= 366 ? "week" : dias <= 3660 ? "month" : "year";

  return { desde, hasta, bucket, recortadoAHoy };
}

async function leerSerieRango(supabase: SupabaseClient, id: number, rango: Rango): Promise<SerieLeida> {
  const { data, error } = await supabase.rpc("qr_scan_series_rango", {
    p_qr_id: id,
    p_bucket: rango.bucket,
    p_desde: rango.desde,
    p_hasta: rango.hasta,
  });
  if (error) return { data: [], error };

  const filas = (data ?? []) as { bucket_start: string; qr: number; nfc: number }[];
  return {
    data: filas.map((fila) => {
      const qr = Number(fila.qr);
      const nfc = Number(fila.nfc);
      return { bucket_start: fila.bucket_start, scans: qr + nfc, qr, nfc };
    }),
    error: null,
  };
}

/** La fecha de hoy (o de cualquier momento) como dia de Argentina, AAAA-MM-DD. */
function fechaArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * La serie del grafico, separada en QR y NFC.
 *
 * Si la base todavia no tiene la funcion separada (falta correr la
 * migracion), se usa la de siempre y el grafico muestra solo el total: la
 * pagina nunca se rompe por una migracion pendiente.
 */
async function leerSerie(
  supabase: SupabaseClient,
  id: number,
  bucket: ScanBucket,
): Promise<SerieLeida> {
  const args = { p_qr_id: id, p_bucket: bucket, p_from: rangeStart(bucket).toISOString() };

  const separada = await supabase.rpc("qr_scan_series_via", args);
  if (!separada.error) {
    const filas = (separada.data ?? []) as { bucket_start: string; qr: number; nfc: number }[];
    return {
      data: filas.map((fila) => {
        const qr = Number(fila.qr);
        const nfc = Number(fila.nfc);
        return { bucket_start: fila.bucket_start, scans: qr + nfc, qr, nfc };
      }),
      error: null,
    };
  }

  const total = await supabase.rpc("qr_scan_series", args);
  return { data: (total.data ?? []) as ScanSeriesPoint[], error: total.error };
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function rangeStart(bucket: ScanBucket): Date {
  const date = new Date();
  if (bucket === "day") date.setDate(date.getDate() - 29);
  if (bucket === "week") date.setDate(date.getDate() - 7 * 11);
  if (bucket === "month") date.setMonth(date.getMonth() - 11);
  return date;
}
