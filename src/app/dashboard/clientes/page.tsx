import Link from "next/link";
import { redirect } from "next/navigation";

import { AVISO_MIGRACION_CLIENTES, faltaMigracionClientes, mostrarTelefono, type Cliente } from "@/lib/clientes";
import { sesionActual } from "@/lib/roles";

import { ClienteForm } from "./Formularios";

export const dynamic = "force-dynamic";

type Fila = Cliente & { cliente_telefonos: { telefono: string }[]; qr_codes: { count: number }[] };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");

  const q = ((await searchParams).q ?? "").trim();

  let consulta = sesion.supabase
    .from("clientes")
    .select("id, nombre, contacto, notas, creado_en, cliente_telefonos(telefono), qr_codes(count)")
    .order("nombre", { ascending: true })
    .limit(1000);
  if (q) {
    const limpio = q.replace(/[%,()*\\]/g, " ");
    consulta = consulta.or(`nombre.ilike.%${limpio}%,contacto.ilike.%${limpio}%`);
  }
  const { data, error } = await consulta;
  const clientes = (data ?? []) as Fila[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-ink-2">
          De quién es cada placa. Con el WhatsApp de cada cliente, más adelante el bot va a saber qué
          estadísticas mostrarle a cada uno.
        </p>
      </div>

      {error ? (
        <div className="card p-5 text-sm" style={{ color: "var(--danger)" }}>
          {faltaMigracionClientes(error) ? AVISO_MIGRACION_CLIENTES : `No pude leer los clientes: ${error.message}`}
        </div>
      ) : (
        <>
          <details className="card p-5" open={clientes.length === 0 && !q}>
            <summary className="cursor-pointer text-sm font-semibold">Nuevo cliente</summary>
            <div className="mt-4 max-w-lg">
              <ClienteForm />
            </div>
          </details>

          <form className="flex gap-2" action="/dashboard/clientes">
            <input name="q" defaultValue={q} className="input max-w-sm" placeholder="Buscar por negocio o contacto…" />
            <button type="submit" className="btn btn-secondary">
              Buscar
            </button>
            {q ? (
              <Link href="/dashboard/clientes" className="btn btn-ghost">
                Limpiar
              </Link>
            ) : null}
          </form>

          {clientes.length === 0 ? (
            <div className="card p-10 text-center text-sm text-ink-3">
              {q ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes. Creá el primero arriba."}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clientes.map((cliente) => {
                const placas = cliente.qr_codes?.[0]?.count ?? 0;
                return (
                  <li key={cliente.id}>
                    <Link
                      href={`/dashboard/clientes/${cliente.id}`}
                      className="card block h-full p-4 no-underline transition-colors hover:border-[var(--brand-2)]"
                    >
                      <p className="font-semibold text-ink-1">{cliente.nombre}</p>
                      {cliente.contacto ? <p className="text-sm text-ink-2">{cliente.contacto}</p> : null}
                      <p className="mt-1 text-xs text-ink-3">
                        {cliente.cliente_telefonos.length > 0
                          ? cliente.cliente_telefonos.map((t) => mostrarTelefono(t.telefono)).join(" · ")
                          : "Sin WhatsApp cargado"}
                      </p>
                      <p className="mt-2 text-xs text-ink-2">{placas === 1 ? "1 placa" : `${placas} placas`}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
