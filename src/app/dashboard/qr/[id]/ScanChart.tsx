"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ScanBucket, ScanSeriesPoint } from "@/lib/types";

const HEIGHT = 220;
const PAD = { top: 18, right: 12, bottom: 30, left: 42 };
const BAR_GAP = 2; // separacion de superficie entre barras contiguas
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

  const points = useMemo(
    () => data.map((point) => ({ date: parseBucket(point.bucket_start), value: Number(point.scans) })),
    [data],
  );

  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const { scaleMax, ticks } = niceScale(maxValue);
  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(2, Math.min(28, slot - BAR_GAP));

  const total = points.reduce((sum, p) => sum + p.value, 0);
  const peakIndex = points.reduce(
    (best, p, i) => (p.value > points[best]!.value ? i : best),
    0,
  );

  const labelEvery = Math.max(1, Math.ceil(points.length / (plotWidth < 480 ? 5 : 9)));
  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-2">
          <span className="font-mono font-semibold text-ink-1 tabular-nums">{total}</span> escaneos en
          el período
        </p>
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
                <th className="py-1.5 text-right font-semibold">Escaneos</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={index} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1.5">{formatFull(point.date, bucket)}</td>
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
          aria-label={`Escaneos por ${BUCKET_NOUN[bucket]}: ${total} en total`}
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

            return (
              <g key={index}>
                {point.value > 0 ? (
                  <path
                    d={roundedTopBar(x, y, barWidth, height)}
                    fill="var(--series-1)"
                    opacity={hover === null || isHovered ? 1 : 0.5}
                  />
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
          <p className="font-mono text-sm font-semibold tabular-nums">
            {active.value} escaneo{active.value === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const BUCKET_NOUN: Record<ScanBucket, string> = {
  day: "día",
  week: "semana",
  month: "mes",
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
  if (bucket === "month") {
    return date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  }
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function formatFull(date: Date, bucket: ScanBucket): string {
  if (bucket === "month") {
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }
  const label = date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  return bucket === "week" ? `Semana del ${label}` : label;
}
