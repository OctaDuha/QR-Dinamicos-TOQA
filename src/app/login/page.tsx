import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="text-xs font-bold tracking-[0.22em] text-ink-3 uppercase">TOQA</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">QR dinámicos</h1>
          <p className="mt-1.5 text-sm text-ink-2">Panel de administración</p>
        </div>

        <div className="card p-6">
          <LoginForm next={target} />
        </div>

        <p className="mt-5 text-center text-xs text-ink-3">
          Los usuarios se crean desde Supabase · Authentication · Users.
        </p>
      </div>
    </main>
  );
}
