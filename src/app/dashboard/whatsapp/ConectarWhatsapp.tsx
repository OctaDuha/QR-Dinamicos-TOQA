"use client";

import { useEffect, useRef, useState } from "react";

import { CopyButton } from "../_components/CopyButton";
import { conectarWhatsapp, type Conexion } from "./actions";

type RespuestaLogin = { authResponse?: { code?: string } | null; status?: string };
type FacebookSdk = {
  init: (opciones: Record<string, unknown>) => void;
  login: (alTerminar: (respuesta: RespuestaLogin) => void, opciones: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

type Estado = "cargando" | "listo" | "abierto" | "guardando" | "sin-sdk";

/** Lo que manda la ventanita de Meta mientras se completa. */
type Sesion = { wabaId?: string; phoneId?: string; cancelo?: string; error?: string };

/**
 * El botón para conectar el WhatsApp Business que ya se usa en el celular,
 * con la ventanita oficial de Meta ("registro insertado"). La app del
 * celular sigue funcionando: Meta lo llama "coexistencia".
 */
export function ConectarWhatsapp({
  appId,
  configId,
  version,
}: {
  appId: string;
  configId: string;
  version: string;
}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [resultado, setResultado] = useState<Conexion | null>(null);
  const sesion = useRef<Sesion>({});

  // El SDK de Meta se carga solo en esta pantalla.
  useEffect(() => {
    if (window.FB) {
      setEstado("listo");
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      setEstado("listo");
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => setEstado("sin-sdk");
    document.body.appendChild(script);
  }, [appId, version]);

  // La ventanita avisa por mensajes qué cuenta y qué número se conectaron.
  useEffect(() => {
    const escuchar = (evento: MessageEvent) => {
      try {
        if (!/(^|\.)facebook\.com$/.test(new URL(evento.origin).hostname)) return;
        const datos = typeof evento.data === "string" ? JSON.parse(evento.data) : evento.data;
        if (datos?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(datos.event).startsWith("FINISH")) {
          sesion.current = { wabaId: datos.data?.waba_id, phoneId: datos.data?.phone_number_id };
        } else if (datos.event === "CANCEL") {
          sesion.current = { cancelo: datos.data?.current_step ?? "sí" };
        } else if (datos.event === "ERROR") {
          sesion.current = { error: datos.data?.error_message ?? "Error en la ventana de Meta." };
        }
      } catch {
        // Otros mensajes (de Facebook o de otro lado) que no son de la conexión.
      }
    };
    window.addEventListener("message", escuchar);
    return () => window.removeEventListener("message", escuchar);
  }, []);

  const terminar = async (codigo: string | undefined) => {
    // El aviso con la cuenta y el número puede llegar un poco después.
    for (let i = 0; i < 20 && !sesion.current.phoneId && !sesion.current.error; i++) {
      await new Promise((listo) => setTimeout(listo, 250));
    }
    const { wabaId, phoneId, cancelo, error } = sesion.current;
    if (!codigo || !wabaId || !phoneId) {
      setResultado({
        ok: false,
        error: error
          ? `Meta avisó un error: ${error}`
          : cancelo
            ? "Cerraste la ventana antes de terminar. Cuando quieras, probá de nuevo."
            : "La conexión no terminó. Probá de nuevo.",
      });
      setEstado("listo");
      return;
    }
    setEstado("guardando");
    setResultado(await conectarWhatsapp({ codigo, wabaId, phoneId }));
    setEstado("listo");
  };

  const abrir = () => {
    if (!window.FB) return;
    sesion.current = {};
    setResultado(null);
    setEstado("abierto");
    window.FB.login(
      // El SDK no acepta una función async acá.
      (respuesta) => {
        void terminar(respuesta.authResponse?.code);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  };

  if (resultado?.ok) return <Conectado conexion={resultado} />;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="btn btn-primary self-start"
        disabled={estado !== "listo"}
        onClick={abrir}
      >
        {estado === "cargando"
          ? "Preparando…"
          : estado === "abierto"
            ? "Completá la ventana de Meta…"
            : estado === "guardando"
              ? "Conectando…"
              : "Conectar mi WhatsApp Business"}
      </button>

      {estado === "sin-sdk" ? (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          No pude cargar la ventana de Meta. Si tenés un bloqueador de publicidad, desactivalo en esta página y
          recargá.
        </p>
      ) : null}

      {resultado && !resultado.ok ? (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {resultado.error}
        </p>
      ) : null}
    </div>
  );
}

function Conectado({ conexion }: { conexion: Extract<Conexion, { ok: true }> }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)" }}>
      <p className="font-semibold">
        ✅ Conectado{conexion.nombre ? `: ${conexion.nombre}` : ""}
        {conexion.numero ? ` (+${conexion.numero})` : ""}
      </p>
      <p className="text-xs text-ink-2">
        La app del celular sigue funcionando. El bot todavía no responde en este número: falta lo de abajo. Copiá
        estos datos ahora, antes de salir de la página.
      </p>

      <Valor nombre="WHATSAPP_PHONE_ID" valor={conexion.phoneId} />
      {conexion.numero ? <Valor nombre="WHATSAPP_NUMERO" valor={conexion.numero} /> : null}
      <Valor nombre="Cuenta de WhatsApp (para buscarla en Meta)" valor={conexion.wabaId} />

      <ol className="ml-4 flex list-decimal flex-col gap-1 text-xs text-ink-2">
        <li>
          En Meta Business → Configuración → Usuarios del sistema → tu usuario → <strong>Asignar activos</strong> →
          Cuentas de WhatsApp: elegí la cuenta nueva, con <strong>control total</strong>.
        </li>
        <li>
          En tu app de Meta → WhatsApp → Configuración → Campos del webhook: suscribite también a{" "}
          <code>smb_message_echoes</code> (así el bot se calla cuando respondés vos desde el celular).
        </li>
        <li>
          En Vercel → Settings → Environment Variables: cambiá <code>WHATSAPP_PHONE_ID</code>
          {conexion.numero ? (
            <>
              {" "}
              y <code>WHATSAPP_NUMERO</code>
            </>
          ) : null}{" "}
          por los de arriba y hacé <strong>Redeploy</strong>.
        </li>
        <li>Desde otro celular, escribile a tu número: tiene que llegar el menú.</li>
      </ol>
    </div>
  );
}

function Valor({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div>
      <p className="label">{nombre}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-xs break-all text-ink-2">{valor}</code>
        <CopyButton value={valor} />
      </div>
    </div>
  );
}
