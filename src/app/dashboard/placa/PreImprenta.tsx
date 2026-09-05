import type { Chequeo } from "@/lib/pre-imprenta";

/**
 * Cartel de "antes de imprimir". Se muestra arriba de todo en la pantalla
 * desde la que se generan los PDF, porque es el ultimo momento en que
 * cualquiera de estas cosas se puede corregir gratis.
 */
export function PreImprenta({ chequeos, urlMuestra }: { chequeos: Chequeo[]; urlMuestra: string }) {
  const pendientes = chequeos.filter((c) => !c.ok);
  const todoListo = pendientes.length === 0;

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: todoListo ? "var(--accent)" : "var(--danger)",
        background: todoListo ? "var(--accent-soft)" : "var(--danger-soft)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          className="text-sm font-semibold"
          style={{ color: todoListo ? "var(--accent)" : "var(--danger)" }}
        >
          {todoListo
            ? "Listo para imprimir"
            : `Antes de imprimir: ${pendientes.length} ${pendientes.length === 1 ? "cosa" : "cosas"} para revisar`}
        </h2>
        <p className="font-mono text-xs text-ink-2">
          Cada placa va a decir <strong className="text-ink">{urlMuestra}</strong>
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {chequeos.map((chequeo) => (
          <li key={chequeo.clave} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: chequeo.ok ? "var(--accent)" : "var(--danger)",
                color: "#fff",
              }}
            >
              {chequeo.ok ? "✓" : "!"}
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">
                <span className="sr-only">{chequeo.ok ? "Listo: " : "Falta: "}</span>
                {chequeo.titulo}
              </p>
              <p className="text-xs text-ink-2">{chequeo.detalle}</p>
              {chequeo.comoArreglar ? (
                <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>
                  {chequeo.comoArreglar}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-ink-3">
        Todo esto se arregla en minutos hoy. Una vez impresa, la dirección que lleva la placa no se
        puede cambiar nunca más.
      </p>
    </div>
  );
}
