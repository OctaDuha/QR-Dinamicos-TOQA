function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiala de .env.example a .env.local (o al panel de Vercel).`,
    );
  }
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
