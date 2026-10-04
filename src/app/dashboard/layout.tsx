import Link from "next/link";

import { sesionActual } from "@/lib/roles";

import { logout } from "../login/actions";
import { NavLinks } from "./_components/NavLinks";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();

  // Una cuenta que existe pero no fue aprobada no ve el panel. La base ya le
  // niega todo; esto es para que lo entienda en vez de ver tablas vacias.
  if (sesion?.rol === "pendiente") {
    return <CuentaPendiente email={sesion.email} />;
  }

  return (
    <div className="min-h-screen">
      <header className="marca-barra sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
          <Link href="/dashboard" className="marca-logo">
            <span className="marca-nombre">
              TOQA<span className="marca-punto">.</span>
            </span>
            <span className="marca-sub">QR dinámicos</span>
          </Link>

          <NavLinks esDueno={sesion?.rol === "dueno"} />

          <form action={logout} className="ml-auto">
            <button type="submit" className="nav-link" style={{ border: 0, background: "transparent", cursor: "pointer" }}>
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
    </div>
  );
}

function CuentaPendiente({ email }: { email: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="card w-full max-w-md p-6 text-center">
        <p className="text-sm font-bold tracking-[0.22em] uppercase" style={{ color: "var(--accent)" }}>
          TOQA<span className="numero-placa">.</span>
        </p>
        <h1 className="mt-3 text-lg font-semibold">Tu cuenta todavía no tiene acceso</h1>
        <p className="mt-2 text-sm text-ink-2">
          Entraste como <strong className="text-ink-1">{email ?? "esta cuenta"}</strong>, pero el
          dueño del panel todavía no la aprobó. Cuando lo haga, vas a poder entrar normalmente.
        </p>
        <form action={logout} className="mt-5">
          <button type="submit" className="btn btn-secondary">
            Salir
          </button>
        </form>
      </div>
    </main>
  );
}
