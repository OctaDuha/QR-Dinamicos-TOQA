import { listDesigns } from "@/lib/placa-designs";
import { createClient } from "@/lib/supabase/server";

import { PlacaStudio, type Design } from "./PlacaStudio";

export const dynamic = "force-dynamic";

export default async function PlacaPage() {
  const supabase = await createClient();
  const designs = (await listDesigns(supabase)) as unknown as Design[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Placas para imprenta</h1>
        <p className="mt-1 text-sm text-ink-2">
          Subís cada diseño una vez —Google, Instagram, WhatsApp— y el sistema encuentra solo dónde
          va el QR. Después pedís 100 placas y salen con un QR dinámico distinto cada una.
        </p>
      </div>

      <PlacaStudio initialDesigns={designs} />
    </div>
  );
}
