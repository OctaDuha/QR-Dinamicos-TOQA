"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ScanBucket, ScanSeriesPoint } from "@/lib/types";

const HEIGHT = 220;
const PAD = { top: 18, right: 12, bottom: 30, left: 42 };
const BAR_GAP = 2; // separacion de superficie entre barras contiguas
const STACK_GAP = 2; // la misma separacion, entre el tramo QR y el NFC de una barra
const RADIUS = 4; // punta redondeada, anclada a la linea de base

type Props = {
  data: ScanSeriesPoint[];
  bucket: ScanBucket;
};

export function ScanChart({ data, bucket }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Si la base todavia no separa por puerta, cada barra es el total y el
  // grafico se ve como siempre: una sola serie, sin leyenda.
  const separado = data.length > 0 && data.every((p) => p.qr !== undefined && p.nfc !== undefined);

  const points = useMemo(
    () =>
      data.map((point) => {
        const value = Number(point.scans);
        const nfc = separado ? Number(point.nfc) : 0;
        return { date: parseBucket(point.bucket_start), value, qr: value - nfc, nfc };
      }),
    [data, separado],
  );

  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const { scaleMax, ticks } = niceScale(maxValue);
  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(2, Math.min(28, slot - BAR_GAP));

  const total = points.reduce((sum, p) => sum + p.value, 0);
  const totalQr = points.reduce((sum, p) => sum + p.qr, 0);
  const totalNfc = points.reduce((sum, p) => sum + p.nfc, 0);
  const peakIndex = points.reduce(
    (best, p, i) => (p.value > points[best]!.value ? i : best),
    0,
  );

  const labelEvery = Math.max(1, Math.ceil(points.length / (plotWidth < 480 ? 5 : 9)));
  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-sm text-ink-2">
            <span className="font-mono font-semibold text-ink-1 tabular-nums">{total}</span> escaneos
            en el período
          </p>
          {separado ? (
            <p className="flex items-center gap-3 text-xs text-ink-2" aria-label="Referencias">
              <Referencia color="var(--series-qr)" texto="QR" valor={totalQr} />
              <Referencia color="var(--series-nfc)" texto="NFC" valor={totalNfc} />
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-[240px] overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Escaneos por {BUCKET_NOUN[bucket]}</caption>
            <thead>
              <tr className="text-left text-xs text-ink-3 uppercase">
                <th className="py-1.5 font-semibold">{BUCKET_NOUN[bucket]}</th>
                {separado ? (
                  <>
                    <th className="py-1.5 text-right font-semibold">QR</th>
                    <th className="py-1.5 text-right font-semibold">NFC</th>
                    <th className="py-1.5 text-right font-semibold">Total</th>
                  </>
                ) : (
                  <th className="py-1.5 text-right font-semibold">Escaneos</th>
                )}
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={index} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1.5">{formatFull(point.date, bucket)}</td>
                  {separado ? (
                    <>
                      <td className="py-1.5 text-right font-mono tabular-nums">{point.qr}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{point.nfc}</td>
                    </>
                  ) : null}
                  <td className="py-1.5 text-right font-mono tabular-nums">{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            separado
              ? `Escaneos por ${BUCKET_NOUN[bucket]}: ${total} en total, ${totalQr} por QR y ${totalNfc} por NFC`
              : `Escaneos por ${BUCKET_NOUN[bucket]}: ${total} en total`
          }
          onMouseLeave={() => setHover(null)}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {/* grilla recesiva */}
          {ticks.map((tick) => {
            const y = PAD.top + plotHeight - (tick / scaleMax) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--ink-3)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {points.map((point, index) => {
            const x = PAD.left + index * slot + (slot - barWidth) / 2;
            const height = (point.value / scaleMax) * plotHeight;
            const y = PAD.top + plotHeight - height;
            const isHovered = hover === index;
            const opacity = hover === null || isHovered ? 1 : 0.5;

            return (
              <g key={index}>
                {point.value > 0 ? (
                  separado ? (
                    <BarraApilada
                      x={x}
                      baseline={PAD.top + plotHeight}
                      width={barWidth}
                      qrHeight={(point.qr / scaleMax) * plotHeight}
                      nfcHeight={(point.nfc / scaleMax) * plotHeight}
                      opacity={opacity}
                    />
                  ) : (
                    <path
                      d={roundedTopBar(x, y, barWidth, height)}
                      fill="var(--series-1)"
                      opacity={opacity}
                    />
                  )
                ) : null}

                {/* etiqueta directa selectiva: solo el pico */}
                {index === peakIndex && point.value > 0 && points.length > 1 ? (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--ink-2)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {point.value}
                  </text>
                ) : null}

                {index % labelEvery === 0 ? (
                  <text
                    x={x + barWidth / 2}
                    y={HEIGHT - 10}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--ink-3)"
                  >
                    {formatAxis(point.date, bucket)}
                  </text>
                ) : null}

                {/* zona de hover mas grande que la barra */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                />
              </g>
            );
          })}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + plotHeight}
            y2={PAD.top + plotHeight}
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
        </svg>
      )}

      {active && !showTable ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line-strong)",
            left: Math.min(
              Math.max(PAD.left + (hover! + 0.5) * slot - 70, 0),
              Math.max(0, width - 140),
            ),
            top: 24,
            width: 140,
          }}
        >
          <p className="text-ink-2">{formatFull(active.date, bucket)}</p>
          {separado ? (
            <div className="mt-1 flex flex-col gap-0.5">
              <FilaTooltip color="var(--series-qr)" texto="QR" valor={active.qr} />
              <FilaTooltip color="var(--series-nfc)" texto="NFC" valor={active.nfc} />
              <p
                className="mt-0.5 flex justify-between border-t pt-0.5 font-semibold"
                style={{ borderColor: "var(--line)" }}
              >
                <span>Total</span>
                <span className="font-mono tabular-nums">{active.value}</span>
              </p>
            </div>
          ) : (
            <p className="font-mono text-sm font-semibold tabular-nums">
              {active.value} escaneo{active.value === 1 ? "" : "s"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Una barra partida en dos: QR abajo, NFC arriba, con una separacion del
 * color del fondo entre las dos. La punta redondeada va solo arriba de todo,
 * que es donde termina el dato; el tramo de abajo queda recto.
 */
function BarraApilada({
  x,
  baseline,
  width,
  qrHeight,
  nfcHeight,
  opacity,
}: {
  x: number;
  baseline: number;
  width: number;
  qrHeight: number;
  nfcHeight: number;
  opacity: number;
}) {
  const qrTop = baseline - qrHeight;
  const ambos = qrHeight > 0 && nfcHeight > 0;
  // La separacion sale del tramo de arriba, para que la barra entera mida
  // lo mismo que el total. Un tramo de NFC muy chico nunca desaparece.
  const nfcVisible = ambos ? Math.max(1, nfcHeight - STACK_GAP) : nfcHeight;
  const nfcBottom = ambos ? qrTop - STACK_GAP : baseline;

  return (
    <g opacity={opacity}>
      {qrHeight > 0 ? (
        <path
          d={ambos ? squareBar(x, qrTop, width, qrHeight) : roundedTopBar(x, qrTop, width, qrHeight)}
          fill="var(--series-qr)"
        />
      ) : null}
      {nfcHeight > 0 ? (
        <path d={roundedTopBar(x, nfcBottom - nfcVisible, width, nfcVisible)} fill="var(--series-nfc)" />
      ) : null}
    </g>
  );
}

function Referencia({ color, texto, valor }: { color: string; texto: string; valor: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {texto}
      <span className="font-mono text-ink-1 tabular-nums">{valor}</span>
    </span>
  );
}

function FilaTooltip({ color, texto, valor }: { color: string; texto: string; valor: number }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-ink-2">
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
        {texto}
      </span>
      <span className="font-mono tabular-nums">{valor}</span>
    </p>
  );
}

const BUCKET_NOUN: Record<ScanBucket, string> = {
  day: "día",
  week: "semana",
  month: "mes",
  year: "año",
};

/** El backend devuelve un timestamp sin zona ya convertido a hora local. */
function parseBucket(value: string): Date {
  const [datePart] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function roundedTopBar(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height);
  const bottom = y + height;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

function squareBar(x: number, y: number, width: number, height: number): string {
  return `M ${x} ${y + height} L ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} Z`;
}

/**
 * Escala con marcas enteras: los escaneos se cuentan de a uno, un eje que
 * dice "12,5" no significa nada.
 */
function niceScale(maxValue: number): { scaleMax: number; ticks: number[] } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

  for (const step of steps) {
    const intervals = Math.ceil(maxValue / step);
    if (intervals >= 1 && intervals <= 4) {
      const scaleMax = step * intervals;
      return {
        scaleMax,
        ticks: Array.from({ length: intervals + 1 }, (_, i) => i * step),
      };
    }
  }

  const step = Math.ceil(maxValue / 4);
  return { scaleMax: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
}

function formatAxis(date: Date, bucket: ScanBucket): string {
  if (bucket === "year") return String(date.getFullYear());
  if (bucket === "month") {
    // Con el año corto: un rango elegido a mano puede abarcar varios años, y
    // "oct" solo no dice cual.
    const mes = date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
    return `${mes} ${String(date.getFullYear()).slice(2)}`;
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function formatFull(date: Date, bucket: ScanBucket): string {
  if (bucket === "year") return `Año ${date.getFullYear()}`;
  if (bucket === "month") {
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }
  const label = date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  return bucket === "week" ? `Semana del ${label}` : label;
}
