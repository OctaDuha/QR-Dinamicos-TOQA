"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatQrCode, qrTargetUrl } from "@/lib/qr";
import type { QrCodeWithStats } from "@/lib/types";

import { CopyButton } from "./_components/CopyButton";

export type DesignOption = { id: number; name: string };

/**
 * Listado con casillas para marcar QR sueltos y bajar sus placas.
 * El rango (del 1 al 100) sirve para lotes nuevos; esto es para cuando hay
 * que reimprimir unos pocos, elegidos a mano.
 */
export function QrTable({
  codes,
  base,
  designs,
}: {
  codes: QrCodeWithStats[];
  base: string;
  designs: DesignOption[];
}) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [design, setDesign] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todosMarcados = codes.length > 0 && codes.every((c) => marcados.has(c.id));
  const seleccion = useMemo(() => [...marcados].sort((a, b) => a - b), [marcados]);

  const alternar = (id: number) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const alternarTodos = () =>
    setMarcados((prev) => {
      if (todosMarcados) {
        const next = new Set(prev);
        for (const c of codes) next.delete(c.id);
        return next;
      }
      return new Set([...prev, ...codes.map((c) => c.id)]);
    });

  const descargar = async (zip: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/placa/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: seleccion,
          design: design ? Number(design) : undefined,
          zip,
        }),
      });

      if (!response.ok) {
        setError(await response.text());
        return;
      }

      const blob = await response.blob();
      const nombre =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        (zip ? "placas.zip" : "placas.pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Algo falló: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {seleccion.length > 0 ? (
        <div
          className="sticky top-[57px] z-10 flex flex-wrap items-end gap-3 rounded-xl border p-4"
          style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            {seleccion.length} {seleccion.length === 1 ? "QR marcado" : "QR marcados"}
          </p>

          <div className="min-w-[170px]">
            <label className="label" htmlFor="sel-design">
              Diseño
            </label>
            <select
              id="sel-design"
              className="input"
              value={design}
              onChange={(event) => setDesign(event.target.value)}
            >
              <option value="">El de cada QR</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="btn btn-primary" onClick={() => descargar(false)} disabled={busy}>
            {busy ? "Armando…" : "Descargar placas en un PDF"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => descargar(true)} disabled={busy}>
            ZIP, un PDF por placa
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setMarcados(new Set())}>
            Desmarcar todo
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          {error}
        </p>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr
                className="text-left text-xs tracking-wide text-ink-2 uppercase"
                style={{ background: "var(--surface-2)" }}
              >
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    aria-label="Marcar todos los de esta página"
                  />
                </th>
                <Th className="w-24">Número</Th>
                <Th>Etiqueta</Th>
                <Th>Destino actual</Th>
                <Th className="w-36">Diseño</Th>
                <Th className="w-28 text-right">Escaneos</Th>
                <Th className="w-44 text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr
                  key={code.id}
                  className="border-t"
                  style={{
                    borderColor: "var(--line)",
                    background: marcados.has(code.id) ? "var(--accent-soft)" : undefined,
                  }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={marcados.has(code.id)}
                      onChange={() => alternar(code.id)}
                      aria-label={`Marcar el QR ${formatQrCode(code.id)}`}
                    />
                  </td>
                  <Td>
                    <Link
                      href={`/dashboard/qr/${code.id}`}
                      className="font-mono font-semibold no-underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {formatQrCode(code.id)}
                    </Link>
                  </Td>
                  <Td>{code.label ?? <span className="text-ink-3">—</span>}</Td>
                  <Td>
                    <a
                      href={code.destination_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block max-w-[34ch] truncate text-ink-2 hover:underline"
                      title={code.destination_url}
                    >
                      {code.destination_url}
                    </a>
                  </Td>
                  <Td>
                    {code.design_name ? (
                      <span className="chip">{code.design_name}</span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{code.total_scans}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <CopyButton
                        value={qrTargetUrl(code.id, base)}
                        title="Copiar la URL que apunta el QR"
                      />
                      <Link href={`/dashboard/qr/${code.id}`} className="btn btn-secondary text-xs">
                        Editar
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
