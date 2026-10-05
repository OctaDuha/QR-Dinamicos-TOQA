import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AVISO_MIGRACION_CLIENTES, faltaMigracionClientes, mostrarTelefono, type Cliente } from "@/lib/clientes";
import { fechaArgentina, rangoPorDefecto } from "@/lib/estadisticas";
import { formatQrCode, parseQrId } from "@/lib/qr";
import { sesionActual } from "@/lib/roles";
import type { QrCodeWithStats } from "@/lib/types";

import { AgregarPlacasForm, BorrarClienteForm, ClienteForm } from "../Formularios";
import { PlacaDelCliente } from "./PlacaDelCliente";

export const dynamic = "force-dynamic";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseQrId((await params).id);
  if (id === null) notFound();

  const sesion = await sesionActual();
  if (!sesion) redirect("/login");

  const [{ data: cliente, error }, { data: telefonos }, { data: placasData }] = await Promise.all([
    sesion.supabase.from("clientes").select("id, nombre, contacto, notas, creado_en").eq("id", id).maybeSingle<Cliente>(),
    sesion.supabase.from("cliente_telefonos").select("telefono").eq("cliente_id", id).order("telefono"),
    sesion.supabase
      .from("qr_codes_with_stats")
      .select("*")
      .eq("cliente_id", id)
      .order("id", { ascending: true })
      .limit(1000),
  ]);

  if (error) {
    return (
      <div className="card p-5 text-sm" style={{ color: "var(--danger)" }}>
        {faltaMigracionClientes(error) ? AVISO_MIGRACION_CLIENTES : `No pude leer el cliente: ${error.message}`}
      </div>
    );
  }
  if (!cliente) notFound();

  const placas = (placasData ?? []) as QrCodeWithStats[];
  const escaneos = placas.reduce((total, placa) => total + Number(placa.total_scans), 0);
  const ultimos30 = rangoPorDefecto(fechaArgentina(new Date()));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/clientes" className="text-sm text-ink-2 hover:underline">
          ← Clientes
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{cliente.nombre}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {placas.length === 1 ? "1 placa" : `${placas.length} placas`} ·{" "}
          {escaneos === 1 ? "1 escaneo en total" : `${escaneos} escaneos en total`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="card p-5">
            <ClienteForm
              cliente={{
                ...cliente,
                telefonos: (telefonos ?? []).map((t) => mostrarTelefono(t.telefono as string)),
              }}
            />
          </div>
          {sesion.rol === "dueno" ? (
            <div className="card p-5">
              <p className="label">Zona peligrosa</p>
              <BorrarClienteForm id={cliente.id} nombre={cliente.nombre} placas={placas.length} />
            </div>
          ) : null}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold">Placas</h2>
          {placas.length > 0 ? (
            // Un formulario comun que pide el archivo: el navegador lo descarga
            // sin salir de la pantalla.
            <form
              action="/api/estadisticas/descargar"
              className="mt-3 flex flex-wrap items-end gap-2 rounded-lg p-3"
              style={{ background: "var(--surface-2)" }}
            >
              <input type="hidden" name="cliente" value={cliente.id} />
              <p className="w-full text-xs text-ink-2">
                Estadísticas de todas sus placas, día por día, para abrir en Excel o Google Sheets.
              </p>
              <label className="flex flex-col gap-1 text-xs text-ink-3">
                Desde
                <input type="date" name="desde" required defaultValue={ultimos30.desde} className="input py-1 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-3">
                Hasta
                <input type="date" name="hasta" required defaultValue={ultimos30.hasta} className="input py-1 text-sm" />
              </label>
              <button type="submit" className="btn btn-secondary text-xs">
                Descargar (CSV)
              </button>
            </form>
          ) : null}
          <div className="mt-3">
            <AgregarPlacasForm clienteId={cliente.id} />
          </div>
          {placas.length === 0 ? (
            <p className="mt-5 text-sm text-ink-3">Todavía no tiene placas. Agregalas por número arriba.</p>
          ) : (
            <ul className="mt-5">
              {placas.map((placa) => (
                <PlacaDelCliente
                  key={placa.id}
                  clienteId={cliente.id}
                  placa={placa}
                  numero={formatQrCode(placa.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
