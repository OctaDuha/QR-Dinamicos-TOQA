import { redirect } from "next/navigation";

import { cuando } from "@/lib/historial";
import { mostrarTelefono } from "@/lib/clientes";
import { fechaCorta } from "@/lib/estadisticas";
import { siteUrl } from "@/lib/qr";
import { sesionActual } from "@/lib/roles";
import { textosDelBot } from "@/lib/bot-textos";
import { configWhatsapp, tokenVerificacion } from "@/lib/whatsapp";

import { CopyButton } from "../_components/CopyButton";
import { GenerarLlave } from "./GenerarLlave";
import { TextosBot } from "./TextosBot";

export const dynamic = "force-dynamic";

type Consulta = {
  id: number;
  telefono: string;
  clientes: string | null;
  desde: string | null;
  hasta: string | null;
  resultado: string;
  creado_en: string;
};

const RESULTADO: Record<string, string> = {
  producto: "🛒 quiere un producto: te toca responder",
  problema: "🔧 avisó un problema: te toca responder",
  persona: "💬 quiere hablar con vos: te toca responder",
  enviado: "📊 recibió sus estadísticas",
  "no-registrado": "no recibió estadísticas",
  "sin-placas": "no tiene placas cargadas",
  error: "falló el envío",
};

export default async function WhatsappPage() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "dueno") {
    return (
      <div className="card p-5">
        <h1 className="text-sm font-semibold">WhatsApp</h1>
        <p className="mt-2 text-sm text-ink-2">Sólo el dueño de la cuenta puede configurar el bot.</p>
      </div>
    );
  }

  const config = configWhatsapp();
  const [verificacion, consultas, textos] = await Promise.all([
    sesion.supabase.rpc("bot_llave_valida", { p_llave: config.llave ?? "" }),
    sesion.supabase
      .from("bot_consultas")
      .select("id, telefono, clientes, desde, hasta, resultado, creado_en")
      .order("creado_en", { ascending: false })
      .limit(30),
    sesion.supabase.from("bot_textos").select("clave, texto"),
  ]);
  const textosActuales = textosDelBot(
    Object.fromEntries(((textos.data ?? []) as { clave: string; texto: string }[]).map((t) => [t.clave, t.texto])),
  );
  const migrada = verificacion.error?.code !== "PGRST202";
  const llaveOk = verificacion.data === true;
  const datosMeta = Boolean(config.token && config.appSecret && config.phoneId);
  const webhook = `${siteUrl()}/api/whatsapp`;
  const verificar = tokenVerificacion();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Bot de WhatsApp</h1>
        <p className="mt-1 text-sm text-ink-2">
          Cuando alguien empieza una conversación, el bot le muestra un menú: quiero un producto, estadísticas, cómo
          funciona TOQA, tengo un problema y hablar con nosotros. Las estadísticas y los problemas solo se los
          ofrece a los clientes cargados. En medio de una charla no se mete, y si alguien pide hablar con una
          persona, se calla con ese número por 12 horas.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">Estado</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          <Paso listo={migrada} texto="Base de datos preparada" falta="Correr en Supabase el archivo 2026-10-bot-whatsapp.sql." />
          <Paso
            listo={llaveOk}
            texto="Llave del bot cargada en Vercel"
            falta={
              config.llave
                ? "La llave de Vercel no coincide con la última que generaste: pegá la nueva y hacé Redeploy."
                : "Generala abajo y pegala en Vercel como BOT_LLAVE."
            }
          />
          <Paso
            listo={datosMeta}
            texto="Datos de Meta cargados en Vercel"
            falta={`Faltan: ${[
              !config.token && "WHATSAPP_TOKEN",
              !config.appSecret && "WHATSAPP_APP_SECRET",
              !config.phoneId && "WHATSAPP_PHONE_ID",
            ]
              .filter(Boolean)
              .join(", ")}.`}
          />
          <Paso
            listo={Boolean(config.numero)}
            texto="Número del bot cargado (para el link de los clientes)"
            falta="Falta WHATSAPP_NUMERO: el número del bot, solo dígitos con código de país."
          />
        </ul>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">Llave del bot</h2>
        <p className="mt-1 mb-3 text-sm text-ink-2">
          Es lo que le permite al bot leer las estadísticas, y solo eso. No es la clave de Supabase.
        </p>
        <GenerarLlave hayLlave={llaveOk} />
      </div>

      {llaveOk && verificar ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Para pegar en Meta</h2>
          <p className="mt-1 mb-3 text-sm text-ink-2">
            En tu app de Meta → WhatsApp → Configuración → Webhook. Después, en “Campos del webhook”, suscribite a{" "}
            <code>messages</code>.
          </p>
          <Dato titulo="URL de devolución de llamada" valor={webhook} />
          <Dato titulo="Token de verificación" valor={verificar} />
        </div>
      ) : null}

      {config.numero ? (
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Probar</h2>
          <p className="mt-1 text-sm text-ink-2">
            Desde tu celular, escribile cualquier cosa al <strong>+{config.numero}</strong>: te tiene que llegar el
            menú. Para ver las estadísticas, tu número tiene que estar cargado como WhatsApp de algún cliente. Si
            ya le escribiste hace poco, mandá <strong>menú</strong> para que vuelva a aparecer.
          </p>
        </div>
      ) : null}

      <div className="card p-5">
        <h2 className="text-sm font-semibold">Textos del bot</h2>
        <p className="mt-1 mb-4 text-sm text-ink-2">
          Lo que contesta el bot en cada opción. Cambialos cuando quieras, por ejemplo al sumar productos nuevos.
        </p>
        {textos.error ? (
          <p className="text-sm text-ink-3">Para editarlos falta correr en Supabase el archivo 2026-10-bot-whatsapp.sql.</p>
        ) : (
          <TextosBot actuales={textosActuales} />
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold">Últimas consultas al bot</h2>
        {consultas.error ? (
          <p className="mt-2 text-sm text-ink-3">Todavía no hay consultas (o falta correr la migración).</p>
        ) : (consultas.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Todavía no hay consultas.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {((consultas.data ?? []) as Consulta[]).map((c) => (
              <li key={c.id} className="border-l-2 pl-3 text-sm" style={{ borderColor: "var(--line)" }}>
                <p className="font-medium">
                  {c.clientes ?? "Número que no es de ningún cliente"} · {RESULTADO[c.resultado] ?? c.resultado}
                </p>
                <p className="text-xs text-ink-2">
                  {mostrarTelefono(c.telefono)}
                  {c.desde && c.hasta ? ` · del ${fechaCorta(c.desde)} al ${fechaCorta(c.hasta)}` : ""}
                </p>
                <p className="text-xs text-ink-3">{cuando(c.creado_en)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Paso({ listo, texto, falta }: { listo: boolean; texto: string; falta: string }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true">{listo ? "✅" : "⬜"}</span>
      <span>
        <span className={listo ? "" : "text-ink-2"}>{texto}</span>
        {listo ? null : <span className="block text-xs text-ink-3">{falta}</span>}
      </span>
    </li>
  );
}

function Dato({ titulo, valor, enlace = false }: { titulo: string; valor: string; enlace?: boolean }) {
  return (
    <div className="mb-3">
      <p className="label">{titulo}</p>
      <div className="flex flex-wrap items-center gap-2">
        {enlace ? (
          <a href={valor} target="_blank" rel="noreferrer noopener" className="font-mono text-xs break-all text-ink-2 hover:underline">
            {valor}
          </a>
        ) : (
          <code className="font-mono text-xs break-all text-ink-2">{valor}</code>
        )}
        <CopyButton value={valor} />
      </div>
    </div>
  );
}
