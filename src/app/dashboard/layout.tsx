import Link from "next/link";

import { logout } from "../login/actions";
import { NavLinks } from "./_components/NavLinks";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="marca-barra sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-5 py-3">
          <Link href="/dashboard" className="marca-logo">
            <span className="marca-nombre">
              TOQA<span className="marca-punto">.</span>
            </span>
            <span className="marca-sub">QR dinámicos</span>
          </Link>

          <NavLinks />

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
