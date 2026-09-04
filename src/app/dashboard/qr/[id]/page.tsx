import Link from "next/link";
import { notFound } from "next/navigation";

import { formatQrCode, parseQrId, qrPngDataUrl, qrTargetUrl, siteUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { QrCode, ScanBucket, ScanSeriesPoint } from "@/lib/types";

import { CopyButton } from "../../_components/CopyButton";
import { DeleteQrForm } from "./DeleteQrForm";
import { EditQrForm } from "./EditQrForm";
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
  searchParams: Promise<{ bucket?: string }>;
}) {
  const { id: rawId } = await params;
  const { bucket: rawBucket } = await searchParams;

  const id = parseQrId(rawId);
  if (id === null) notFound();

  const bucket: ScanBucket =
    rawBucket === "week" || rawBucket === "month" ? rawBucket : "day";

  const supabase = await createClient();

  const { data: code } = await supabase
    .from("qr_codes")
    .select("id, label, destination_url, created_at")
    .eq("id", id)
    .maybeSingle<QrCode>();

  if (!code) notFound();

  const [seriesResult, totalResult, recentResult, pngDataUrl] = await Promise.all([
    supabase.rpc("qr_scan_series", {
      p_qr_id: id,
      p_bucket: bucket,
      p_from: rangeStart(bucket).toISOString(),
    }),
    supabase.from("scans").select("id", { count: "exact", head: true }).eq("qr_id", id),
    supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("qr_id", id)
      .gte("scanned_at", daysAgo(30).toISOString()),
    qrPngDataUrl(id, siteUrl(), 420),
  ]);

  const series = (seriesResult.data ?? []) as ScanSeriesPoint[];
  const target = qrTargetUrl(id, siteUrl());
  const activeWindow = BUCKETS.find((b) => b.value === bucket)!.window;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard" className="text-sm text-ink-2 no-underline hover:underline">
          ← Volver a la lista
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            #{formatQrCode(code.id)}
          </h1>
          {code.label ? <span className="chip">{code.label}</span> : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
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
          </div>

          <div className="card grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-xs tracking-wide text-ink-3 uppercase">Total</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {totalResult.count ?? 0}
              </p>
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
                      option.value === bucket ? "btn btn-primary text-xs" : "btn btn-ghost text-xs"
                    }
                    scroll={false}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            {seriesResult.error ? (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                No pude leer las estadísticas: {seriesResult.error.message}
              </p>
            ) : (
              <ScanChart data={series} bucket={bucket} />
            )}
          </div>

          <div className="card p-5">
            <p className="label">Zona peligrosa</p>
            <DeleteQrForm id={code.id} code={formatQrCode(code.id)} />
          </div>
        </div>
      </div>
    </div>
  );
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
