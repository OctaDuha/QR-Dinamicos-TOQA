import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AVISO_MIGRACION_CLIENTES, faltaMigracionClientes, mostrarTelefono, type Cliente } from "@/lib/clientes";
import { formatQrCode, parseQrId } from "@/lib/qr";
import { sesionActual } from "@/lib/roles";
import type { QrCodeWithStats } from "@/lib/types";

import { AgregarPlacasForm, BorrarClienteForm, ClienteForm, QuitarPlacaBoton } from "../Formularios";

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
          <div className="mt-3">
            <AgregarPlacasForm clienteId={cliente.id} />
          </div>
          {placas.length === 0 ? (
            <p className="mt-5 text-sm text-ink-3">Todavía no tiene placas. Agregalas por número arriba.</p>
          ) : (
            <div className="relative mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-ink-2 uppercase">
                    <th className="py-2 pr-3 font-semibold">Número</th>
                    <th className="py-2 pr-3 font-semibold">Etiqueta</th>
                    <th className="py-2 pr-3 font-semibold">Destino</th>
                    <th className="py-2 pr-3 text-right font-semibold">Escaneos</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {placas.map((placa) => (
                    <tr key={placa.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="py-2 pr-3">
                        <Link
                          href={`/dashboard/qr/${placa.id}`}
                          className="numero-placa font-mono font-semibold no-underline hover:underline"
                        >
                          {formatQrCode(placa.id)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{placa.label ?? <span className="text-ink-3">—</span>}</td>
                      <td className="py-2 pr-3">
                        <span className="block max-w-[28ch] truncate text-ink-2" title={placa.destination_url}>
                          {placa.destination_url}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{placa.total_scans}</td>
                      <td className="py-2 text-right">
                        <QuitarPlacaBoton clienteId={cliente.id} qrId={placa.id} numero={formatQrCode(placa.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
