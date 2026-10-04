import type { SupabaseClient } from "@supabase/supabase-js";

import { cuando, describirFila, faltaMigracion, juntarAltas, quien, type FilaHistorial } from "@/lib/historial";

const A_LA_VISTA = 6;

/** Lo que pasó con esta placa, del más nuevo al más viejo. Solo lo ve el dueño. */
export async function HistorialPlaca({ supabase, qrId }: { supabase: SupabaseClient; qrId: number }) {
  const { data, error } = await supabase
    .from("historial")
    .select("id, qr_id, accion, cambios, detalle, usuario_email, creado_en")
    .eq("qr_id", qrId)
    .order("creado_en", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">Historial de esta placa</h2>
      <p className="mb-3 text-xs text-ink-3">Quién la creó, la cambió o la generó para imprenta, y cuándo.</p>
      {error ? (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {faltaMigracion(error) ? (
            <>
              Para ver el historial falta correr en Supabase el archivo <code>2026-10-historial.sql</code>.
            </>
          ) : (
            <>No pude leer el historial: {error.message}</>
          )}
        </p>
      ) : (
        <Lista filas={juntarAltas((data ?? []) as FilaHistorial[])} />
      )}
    </div>
  );
}

function Lista({ filas }: { filas: FilaHistorial[] }) {
  if (filas.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        Todavía no hay nada anotado. El historial arranca el día que se activó: lo anterior no quedó registrado.
      </p>
    );
  }
  const vista = filas.slice(0, A_LA_VISTA);
  const resto = filas.slice(A_LA_VISTA);
  return (
    <>
      <ol className="flex flex-col gap-3">
        {vista.map((fila) => (
          <Renglon key={fila.id} fila={fila} />
        ))}
      </ol>
      {resto.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ink-2">Ver {resto.length} más</summary>
          <ol className="mt-3 flex flex-col gap-3">
            {resto.map((fila) => (
              <Renglon key={fila.id} fila={fila} />
            ))}
          </ol>
        </details>
      ) : null}
    </>
  );
}

function Renglon({ fila }: { fila: FilaHistorial }) {
  const { titulo, detalles } = describirFila(fila);
  return (
    <li className="border-l-2 pl-3" style={{ borderColor: "var(--line)" }}>
      <p className="text-sm font-medium">{titulo}</p>
      {detalles.map((detalle) => (
        <p key={detalle} className="text-xs [overflow-wrap:anywhere] text-ink-2">
          {detalle}
        </p>
      ))}
      <p className="mt-0.5 text-xs text-ink-3">
        {quien(fila.usuario_email)} · {cuando(fila.creado_en)}
      </p>
    </li>
  );
}
