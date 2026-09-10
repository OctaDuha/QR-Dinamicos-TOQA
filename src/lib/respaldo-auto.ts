import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

import { respaldar } from "./respaldo";

/**
 * Dispara la copia despues de contestarle a la persona, no antes: quien
 * acaba de crear un lote no tiene por que esperar a que se guarde el
 * respaldo. Si falla, queda en los registros y se nota en el panel, que
 * muestra cuando fue la ultima copia.
 */
export function respaldarDespues(supabase: SupabaseClient): void {
  after(async () => {
    const resultado = await respaldar(supabase);
    if (!resultado.ok && resultado.error !== "sin configurar") {
      console.error("[respaldo] no se pudo guardar la copia:", resultado.error);
    }
  });
}
