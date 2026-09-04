import { createClient } from "@/lib/supabase/server";
import { loadPlacaSettings } from "@/lib/placa-settings";

import { PlacaEditor } from "./PlacaEditor";

export const dynamic = "force-dynamic";

export default async function PlacaPage() {
  const supabase = await createClient();
  const settings = await loadPlacaSettings(supabase, false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Placas para imprenta</h1>
        <p className="mt-1 text-sm text-ink-2">
          Tu diseño de Canva como fondo, el QR estampado encima por código. Pedís 100 o 1000 y
          bajás un PDF vectorial listo, sin tocar nada a mano.
        </p>
      </div>

      <PlacaEditor
        initialLayout={settings.layout}
        initialBackground={settings.backgroundName}
      />
    </div>
  );
}
