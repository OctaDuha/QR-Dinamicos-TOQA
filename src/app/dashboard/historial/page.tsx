import Link from "next/link";
import { redirect } from "next/navigation";

import {
  cuando,
  describirGrupo,
  faltaMigracion,
  juntarAltasGrupos,
  quien,
  type GrupoHistorial,
} from "@/lib/historial";
import { formatQrCode, parseQrId } from "@/lib/qr";
import { sesionActual } from "@/lib/roles";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

/**
 * Todo lo que se hizo en el panel, del más nuevo al más viejo. Lo que se
 * hizo de una sola vez (un lote de 50, un borrado de varias) va en un renglón.
 */
export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ placa?: string; persona?: string; antes?: string }>;
}) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");

  if (sesion.rol !== "dueno") {
    return (
      <div className="card p-5">
        <h1 className="text-sm font-semibold">Historial</h1>
        <p className="mt-2 text-sm text-ink-2">Sólo el dueño de la cuenta puede ver el historial.</p>
      </div>
    );
  }

  const { placa: rawPlaca, persona: rawPersona, antes: rawAntes } = await searchParams;
  const placa = rawPlaca?.trim() ? parseQrId(rawPlaca.trim()) : null;
  const placaInvalida = Boolean(rawPlaca?.trim()) && placa === null;
  const persona = rawPersona?.trim() || null;
  const antes = rawAntes && !Number.isNaN(Date.parse(rawAntes)) ? rawAntes : null;

  const [{ data, error }, perfiles] = await Promise.all([
    sesion.supabase.rpc("historial_general", {
      p_limite: POR_PAGINA,
      p_antes: antes,
      p_qr: placa,
      p_usuario: persona,
    }),
    sesion.supabase.from("perfiles").select("email").order("email", { ascending: true }),
  ]);

  const grupos = (data ?? []) as GrupoHistorial[];
  const renglones = juntarAltasGrupos(grupos);
  const masViejo = grupos.length === POR_PAGINA ? grupos[grupos.length - 1].creado_en : null;
  const emails = ((perfiles.data ?? []) as { email: string | null }[])
    .map((p) => p.email)
    .filter((e): e is string => Boolean(e));
  const filtrando = placa !== null || persona !== null;

  const conFiltros = (extra: Record<string, string>) => {
    const params = new URLSearchParams();
    if (placa !== null) params.set("placa", formatQrCode(placa));
    if (persona) params.set("persona", persona);
    for (const [clave, valor] of Object.entries(extra)) params.set(clave, valor);
    return `/dashboard/historial?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Historial</h1>
        <p className="mt-1 text-sm text-ink-2">
          Quién creó, cambió, generó para imprenta o borró cada placa, y cuándo. Lo anota la base de
          datos sola: nadie lo puede borrar ni cambiar desde el panel.
        </p>
      </div>

      <form action="/dashboard/historial" className="card flex flex-wrap items-end gap-3 p-5">
        <label className="flex flex-col gap-1 text-xs text-ink-3" htmlFor="placa">
          Placa
          <input
            id="placa"
            name="placa"
            inputMode="numeric"
            placeholder="Ej. 0042"
            defaultValue={rawPlaca ?? ""}
            className="input w-28 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3" htmlFor="persona">
          Persona
          <select id="persona" name="persona" defaultValue={persona ?? ""} className="input py-1 text-sm">
            <option value="">Todas</option>
            {emails.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
            {persona && !emails.includes(persona) ? <option value={persona}>{persona}</option> : null}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary text-xs">
          Filtrar
        </button>
        {filtrando || antes ? (
          <Link href="/dashboard/historial" className="btn btn-ghost text-xs">
            Ver todo
          </Link>
        ) : null}
        {placaInvalida ? (
          <p className="w-full text-xs" style={{ color: "var(--danger)" }}>
            “{rawPlaca}” no es un número de placa. Escribilo como 42 o 0042.
          </p>
        ) : null}
      </form>

      <div className="card p-5">
        {error ? (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {faltaMigracion(error) ? (
              <>
                Para ver el historial falta correr en Supabase el archivo{" "}
                <code>2026-10-historial.sql</code>.
              </>
            ) : (
              <>No pude leer el historial: {error.message}</>
            )}
          </p>
        ) : renglones.length === 0 ? (
          <p className="text-sm text-ink-3">
            {filtrando
              ? "No hay nada anotado con esos filtros."
              : "Todavía no hay nada anotado. El historial arranca el día que se activó: lo anterior no quedó registrado."}
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {renglones.map((grupo) => {
              const { titulo, detalles } = describirGrupo(grupo);
              const una = Number(grupo.cantidad) === 1 && grupo.desde_qr !== null;
              return (
                <li
                  key={`${grupo.creado_en}-${grupo.accion}-${grupo.usuario_email ?? ""}`}
                  className="border-l-2 pl-3"
                  style={{ borderColor: "var(--line)" }}
                >
                  <p className="text-sm font-medium">
                    {una && grupo.accion !== "borro" ? (
                      <Link href={`/dashboard/qr/${grupo.desde_qr}`} className="hover:underline">
                        {titulo}
                      </Link>
                    ) : (
                      titulo
                    )}
                  </p>
                  {detalles.map((detalle) => (
                    <p key={detalle} className="text-xs [overflow-wrap:anywhere] text-ink-2">
                      {detalle}
                    </p>
                  ))}
                  <p className="mt-0.5 text-xs text-ink-3">
                    {quien(grupo.usuario_email)} · {cuando(grupo.creado_en)}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {masViejo ? (
          <div className="mt-5">
            <Link href={conFiltros({ antes: masViejo })} className="btn btn-secondary text-xs">
              Ver más viejos
            </Link>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-ink-3">
        “Sistema” quiere decir que el cambio se hizo directo en Supabase, no desde el panel.
      </p>
    </div>
  );
}
