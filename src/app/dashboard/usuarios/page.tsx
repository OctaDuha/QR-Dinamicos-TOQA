import { redirect } from "next/navigation";

import { sesionActual } from "@/lib/roles";

import { ListaUsuarios, type Usuario } from "./ListaUsuarios";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");

  // La pantalla es del dueño. Aunque alguien entre por la URL, las politicas
  // de la base no lo dejarian cambiar ningun rol igual.
  if (sesion.rol !== "dueno") {
    return (
      <div className="card p-5">
        <h1 className="text-sm font-semibold">Usuarios</h1>
        <p className="mt-2 text-sm text-ink-2">
          Sólo el dueño de la cuenta puede ver y cambiar los roles.
        </p>
      </div>
    );
  }

  const { data } = await sesion.supabase
    .from("perfiles")
    .select("id, email, rol, creado_en")
    .order("creado_en", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-ink-2">
          Quién puede entrar al panel y qué puede hacer. Las cuentas se crean desde Supabase ·
          Authentication · Users; acá les asignás el rol.
        </p>
      </div>

      <ListaUsuarios usuarios={(data ?? []) as Usuario[]} yo={sesion.userId} />

      <div className="card p-5 text-sm text-ink-2">
        <h2 className="text-sm font-semibold text-ink-1">Qué puede hacer cada uno</h2>
        <p className="mt-2">
          <strong className="text-ink-1">Dueño:</strong> todo. Es el único que puede borrar QRs,
          borrar diseños y cambiar estos roles.
        </p>
        <p className="mt-2">
          <strong className="text-ink-1">Empleado:</strong> crear QRs y lotes, editar destinos y
          etiquetas, subir diseños, generar las placas para imprenta y exportar. No puede borrar
          nada.
        </p>
        <p className="mt-3 text-xs text-ink-3">
          El control no está sólo en esta pantalla: aunque alguien intentara saltear el panel, la
          base de datos le rechaza el borrado igual.
        </p>
      </div>
    </div>
  );
}
