import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // La ruta publica /r/[id] queda fuera a proposito: tiene que ser lo mas
  // rapida posible y no necesita sesion.
  matcher: ["/dashboard/:path*", "/login"],
};
