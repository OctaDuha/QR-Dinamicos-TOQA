"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { borrarConAviso } from "@/lib/borrar-qr";
import { formatQrCode } from "@/lib/qr";

/**
 * Borrar de a muchos por numero, sin tener que tildarlos uno por uno.
 * Sirve sobre todo para limpiar las tandas de prueba antes de arrancar en
 * serio, que es cuando hay decenas de QR que no van a ninguna placa.
 */
export function BorrarRangoForm() {
  const router = useRouter();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busy, setBusy] = useState(false);
  const [nota, setNota] = useState<{ malo: boolean; texto: string } | null>(null);

  const borrar = async () => {
    setBusy(true);
    setNota(null);
    try {
      const resultado = await borrarConAviso(
        { from: desde ? Number(desde) : undefined, to: hasta ? Number(hasta) : undefined },
        formatQrCode,
      );
      if (!resultado) return;
      if (resultado.error) {
        setNota({ malo: true, texto: resultado.error });
        return;
      }
      setNota({
        malo: false,
        texto: `Listo: borré ${resultado.borrados} ${resultado.borrados === 1 ? "QR" : "QR"}.`,
      });
      setDesde("");
      setHasta("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">Borrar por número</h2>
        <p className="mt-1 text-sm text-ink-2">
          Del 1 al 50, por ejemplo. Antes de borrar nada te muestro cuántos son y cuántos ya
          fueron escaneados, que es la señal de que hay placas impresas dando vueltas.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <label className="label" htmlFor="borrar-desde">
            Desde
          </label>
          <input
            id="borrar-desde"
            className="input"
            inputMode="numeric"
            placeholder="1"
            value={desde}
            onChange={(event) => setDesde(event.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="w-28">
          <label className="label" htmlFor="borrar-hasta">
            Hasta
          </label>
          <input
            id="borrar-hasta"
            className="input"
            inputMode="numeric"
            placeholder="50"
            value={hasta}
            onChange={(event) => setHasta(event.target.value.replace(/\D/g, ""))}
          />
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={borrar}
          disabled={busy || (!desde && !hasta)}
        >
          {busy ? "Borrando…" : "Borrar ese rango"}
        </button>
      </div>

      {nota ? (
        <p
          role="status"
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            background: nota.malo ? "var(--danger-soft)" : "var(--accent-soft)",
            color: nota.malo ? "var(--danger)" : "var(--accent)",
          }}
        >
          {nota.texto}
        </p>
      ) : null}

      <p className="text-xs text-ink-3">
        Si dejás uno de los dos campos vacío, se toma sin límite de ese lado: “desde 120” en
        blanco borra del 120 en adelante.
      </p>
    </div>
  );
}
