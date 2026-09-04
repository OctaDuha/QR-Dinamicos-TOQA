"use client";

import { useCallback, useEffect, useState } from "react";

type Template = { id: string; title: string };

type Batch = {
  id: number;
  brand_template_id: string;
  status: string;
  error: string | null;
  created_at: string;
  total: number;
  done: number;
  failed: number;
};

export function CanvaPanel({ defaultTemplateId }: { defaultTemplateId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [running, setRunning] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    const response = await fetch("/api/canva/batches", { cache: "no-store" });
    const payload = await response.json();
    setBatches(payload.batches ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/canva/templates", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setTemplates(payload.items ?? []);
        if (payload.error) setTemplatesError(payload.error);
        if (!defaultTemplateId && payload.items?.[0]) setTemplateId(payload.items[0].id);
      })
      .catch((error: Error) => setTemplatesError(error.message));

    void loadBatches();
  }, [defaultTemplateId, loadBatches]);

  /** Llama a /process en tandas hasta terminar el lote. */
  const drain = useCallback(
    async (batchId: number) => {
      setRunning(batchId);
      try {
        for (;;) {
          const response = await fetch(`/api/canva/batches/${batchId}/process`, { method: "POST" });
          const payload = await response.json();

          if (!response.ok) {
            setMessage(payload.error ?? "Falló el procesamiento del lote.");
            break;
          }

          await loadBatches();

          if (payload.finished) {
            setMessage(
              payload.failed > 0
                ? `Lote #${batchId} terminado con ${payload.failed} error(es) de ${payload.total}.`
                : `Lote #${batchId} listo: ${payload.done} diseños.`,
            );
            break;
          }
          if (payload.processed === 0) {
            setMessage("El lote no avanzó en esta tanda. Reintentá en un rato.");
            break;
          }
        }
      } finally {
        setRunning(null);
      }
    },
    [loadBatches],
  );

  const createBatch = async () => {
    setMessage(null);

    const response = await fetch("/api/canva/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand_template_id: templateId,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "No pude crear el lote.");
      return;
    }

    setMessage(`Lote #${payload.id} creado con ${payload.total} diseños. Generando…`);
    await loadBatches();
    await drain(payload.id);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-5">
        <h2 className="text-sm font-semibold">Generar diseños</h2>
        <p className="mt-1 text-sm text-ink-2">
          Sube el PNG de cada QR a Canva, rellena el campo <code>qr_code</code> de la plantilla y
          exporta cada diseño a PDF de impresión.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_110px_110px_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="template">
              Plantilla
            </label>
            {templates.length > 0 ? (
              <select
                id="template"
                className="input"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="template"
                className="input"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                placeholder="ID de la brand template"
              />
            )}
          </div>
          <div>
            <label className="label" htmlFor="from">
              Desde #
            </label>
            <input
              id="from"
              className="input"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              placeholder="1"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              Hasta #
            </label>
            <input
              id="to"
              className="input"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="100"
              inputMode="numeric"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={createBatch}
            disabled={running !== null || !templateId}
          >
            {running !== null ? "Generando…" : "Generar lote"}
          </button>
        </div>

        {templatesError ? (
          <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
            No pude listar las plantillas: {templatesError}
            <br />
            Las <em>brand templates</em> y el autofill son funciones de Canva Enterprise. Si tu cuenta
            no las tiene, pegá el ID a mano o usá la Opción B (ver más abajo).
          </p>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {message}
          </p>
        ) : null}
      </div>

      <div className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Lotes recientes</h2>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => void loadBatches()}>
            Actualizar
          </button>
        </div>

        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Todavía no generaste ningún lote.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {batches.map((batch) => {
              const pending = batch.total - batch.done - batch.failed;
              const percent = batch.total > 0 ? Math.round((batch.done / batch.total) * 100) : 0;

              return (
                <li
                  key={batch.id}
                  className="flex flex-wrap items-center gap-3 border-t pt-3 first:border-0 first:pt-0"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span className="font-mono text-sm font-semibold">#{batch.id}</span>

                  <div className="min-w-[160px] flex-1">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--surface-2)" }}
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${percent}%`, background: "var(--series-1)" }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-3">
                      {batch.done}/{batch.total} listos
                      {batch.failed > 0 ? ` · ${batch.failed} con error` : ""}
                      {pending > 0 ? ` · ${pending} pendientes` : ""}
                    </p>
                  </div>

                  {pending > 0 ? (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => void drain(batch.id)}
                      disabled={running !== null}
                    >
                      {running === batch.id ? "Generando…" : "Continuar"}
                    </button>
                  ) : null}

                  {batch.done > 0 ? (
                    <a className="btn btn-secondary text-xs" href={`/api/canva/batches/${batch.id}/zip`}>
                      Descargar PDFs
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs text-ink-3">
          Los links de exportación de Canva caducan a las pocas horas: bajá el ZIP el mismo día que
          generás el lote.
        </p>
      </div>
    </div>
  );
}
