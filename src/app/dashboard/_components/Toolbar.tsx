"use client";

import { useState } from "react";

import { ImportCsvForm } from "./ImportCsvForm";
import { NewQrForm, type DesignOption } from "./NewQrForm";

type Panel = "new" | "import" | null;

export function Toolbar({
  defaultDestination,
  designs,
}: {
  defaultDestination: string;
  designs: DesignOption[];
}) {
  const [panel, setPanel] = useState<Panel>(null);

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={panel === "new" ? "btn btn-secondary" : "btn btn-primary"}
          onClick={() => toggle("new")}
          aria-expanded={panel === "new"}
        >
          {panel === "new" ? "Cerrar" : "Nuevo QR / lote"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => toggle("import")}
          aria-expanded={panel === "import"}
        >
          Importar CSV
        </button>
        <a className="btn btn-secondary" href="/api/export/zip">
          Exportar ZIP (PNG + CSV)
        </a>
        <a className="btn btn-ghost" href="/api/export/csv">
          Solo CSV
        </a>
      </div>

      {panel === "new" ? (
        <div className="card p-5">
          <NewQrForm defaultDestination={defaultDestination} designs={designs} />
        </div>
      ) : null}

      {panel === "import" ? (
        <div className="card p-5">
          <ImportCsvForm />
        </div>
      ) : null}
    </div>
  );
}
