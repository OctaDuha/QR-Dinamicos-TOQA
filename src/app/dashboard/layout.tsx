import Link from "next/link";

import { logout } from "../login/actions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 border-b"
        style={{ background: "var(--surface-1)", borderColor: "var(--line)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-5 py-3">
          <Link href="/dashboard" className="flex items-baseline gap-2 no-underline">
            <span className="text-xs font-bold tracking-[0.22em] text-ink-3 uppercase">TOQA</span>
            <span className="text-sm font-semibold">QR dinámicos</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link href="/dashboard" className="btn btn-ghost">
              QRs
            </Link>
            <Link href="/dashboard/canva" className="btn btn-ghost">
              Diseños Canva
            </Link>
          </nav>

          <form action={logout} className="ml-auto">
            <button type="submit" className="btn btn-ghost">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
    </div>
  );
}
