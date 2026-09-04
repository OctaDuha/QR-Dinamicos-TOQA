import Link from "next/link";

import { listDesigns } from "@/lib/placa-designs";
import { formatQrCode, qrTargetUrl, siteUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { QrCodeWithStats } from "@/lib/types";

import { CopyButton } from "./_components/CopyButton";
import { Toolbar } from "./_components/Toolbar";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const base = siteUrl();

  let listQuery = supabase
    .from("qr_codes_with_stats")
    .select("*", { count: "exact" })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (query) {
    const asId = Number(query.replace(/^#/, ""));
    listQuery = Number.isInteger(asId) && asId > 0
      ? listQuery.eq("id", asId)
      : listQuery.or(`label.ilike.%${query}%,destination_url.ilike.%${query}%`);
  }

  const [{ data, count, error }, { count: totalScans }, designs] = await Promise.all([
    listQuery,
    supabase.from("scans").select("id", { count: "exact", head: true }),
    listDesigns(supabase),
  ]);

  const codes = (data ?? []) as QrCodeWithStats[];
  const totalCodes = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCodes / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">QRs</h1>
          <p className="mt-1 text-sm text-ink-2">
            El QR impreso nunca cambia: lo único que se edita acá es a dónde redirige.
          </p>
        </div>
        <div className="flex gap-6">
          <Stat label="QRs" value={totalCodes} />
          <Stat label="Escaneos totales" value={totalScans ?? 0} />
        </div>
      </div>

      <Toolbar defaultDestination={`${base}/`} designs={designs.map((d) => ({ id: d.id, name: d.name }))} />

      <form className="flex gap-2" action="/dashboard">
        <input
          name="q"
          defaultValue={query}
          className="input max-w-sm"
          placeholder="Buscar por número, etiqueta o destino…"
        />
        <button type="submit" className="btn btn-secondary">
          Buscar
        </button>
        {query ? (
          <Link href="/dashboard" className="btn btn-ghost">
            Limpiar
          </Link>
        ) : null}
      </form>

      {error ? (
        <p className="card p-5 text-sm" style={{ color: "var(--danger)" }}>
          No pude leer los QR: {error.message}
          <br />
          <span className="text-ink-3">
            ¿Corriste <code>supabase/schema.sql</code> en el proyecto de Supabase?
          </span>
        </p>
      ) : codes.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium">
            {query ? "Ningún QR coincide con la búsqueda." : "Todavía no hay QRs."}
          </p>
          <p className="mt-1 text-sm text-ink-3">
            {query
              ? "Probá con otro número o etiqueta."
              : "Creá un lote nuevo o importá el CSV de la herramienta vieja."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr
                  className="text-left text-xs tracking-wide text-ink-2 uppercase"
                  style={{ background: "var(--surface-2)" }}
                >
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
                  <tr key={code.id} className="border-t" style={{ borderColor: "var(--line)" }}>
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
      )}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">
            Página {page} de {lastPage} · {totalCodes} QR
          </span>
          <div className="flex gap-2">
            <PageLink page={page - 1} disabled={page <= 1} query={query}>
              ← Anterior
            </PageLink>
            <PageLink page={page + 1} disabled={page >= lastPage} query={query}>
              Siguiente →
            </PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="font-mono text-2xl font-semibold tabular-nums">{value.toLocaleString("es-AR")}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function PageLink({
  page,
  disabled,
  query,
  children,
}: {
  page: number;
  disabled: boolean;
  query: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="btn btn-ghost opacity-40">{children}</span>;
  }
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (page > 1) search.set("page", String(page));
  const suffix = search.toString();
  return (
    <Link href={`/dashboard${suffix ? `?${suffix}` : ""}`} className="btn btn-secondary">
      {children}
    </Link>
  );
}
