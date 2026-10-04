import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · TOQA",
  description: "Qué datos guarda TOQA y para qué.",
};

const CONTACTO = "toqa.nfc@gmail.com";
const ACTUALIZADA = "4 de octubre de 2026";

/**
 * Politica de privacidad publica. La pide Google para publicar el inicio de
 * sesion con Google, y describe lo que el sistema hace de verdad: si algun
 * dia cambia lo que se guarda (por ejemplo, empezar a registrar la IP de los
 * escaneos), hay que cambiar esta pagina.
 */
export default function PrivacidadPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-12 text-sm leading-relaxed text-ink-2">
      <header>
        <p className="text-sm font-bold tracking-[0.22em] uppercase" style={{ color: "var(--accent)" }}>
          TOQA<span className="numero-placa">.</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-1">Política de privacidad</h1>
        <p className="mt-1 text-xs text-ink-3">Última actualización: {ACTUALIZADA}</p>
      </header>

      <Seccion titulo="Quiénes somos">
        <p>
          TOQA hace placas para comercios con un código QR y un chip NFC. Al escanear la placa o
          apoyar el celular, la dirección <strong className="text-ink-1">toqaqr.com.ar</strong>{" "}
          lleva a la persona al destino que eligió el comercio: su Instagram, sus reseñas de Google
          o la página que corresponda. TOQA administra esos destinos desde un panel privado.
        </p>
        <p>
          Por cualquier consulta sobre tus datos escribinos a{" "}
          <strong className="text-ink-1">{CONTACTO}</strong>.
        </p>
      </Seccion>

      <Seccion titulo="Si escaneás una placa o apoyás el celular">
        <p>Para contar cuántas veces se usa cada placa, registramos:</p>
        <ul className="list-disc pl-5">
          <li>la fecha y la hora;</li>
          <li>si entraste por el QR o por el chip NFC;</li>
          <li>
            la descripción que tu navegador envía de sí mismo (por ejemplo, "Chrome en Android"),
            sin datos que te identifiquen.
          </li>
        </ul>
        <p>
          No guardamos tu dirección IP, tu ubicación, tu nombre ni ningún otro dato tuyo, no usamos
          cookies en ese paso y no usamos herramientas de publicidad ni de analítica de terceros.
          Como cualquier sitio, nuestro proveedor de alojamiento puede registrar datos técnicos de la
          conexión en sus propios registros de funcionamiento.
        </p>
      </Seccion>

      <Seccion titulo="Si usás el panel de administración">
        <p>
          El panel lo usan solo TOQA y las personas que TOQA invita. Para que puedas entrar
          guardamos tu mail, tu rol y una cookie de sesión, que es necesaria para mantenerte
          conectado.
        </p>
        <p>
          Si entrás con Google, Google nos informa tu nombre, tu mail y tu foto de perfil. Los usamos
          solo para identificarte dentro del panel. No accedemos a tu correo, tus contactos, tus
          archivos ni a ningún otro dato de tu cuenta de Google. El uso de la información recibida de
          las API de Google se ajusta a la Política de Datos del Usuario de los Servicios de API de
          Google, incluidos sus requisitos de uso limitado.
        </p>
        <p>
          Para saber quién hizo cada cosa, el panel anota qué usuario creó, modificó, preparó para
          imprimir o eliminó cada placa, cuándo lo hizo y qué cambió. Ese registro solo lo ve el
          dueño de la cuenta.
        </p>
      </Seccion>

      <Seccion titulo="Datos de los comercios">
        <p>
          De cada placa guardamos su número, el nombre o la etiqueta que le pone TOQA y la dirección
          a la que lleva. Hacemos copias de seguridad de esa lista para no perderla.
        </p>
      </Seccion>

      <Seccion titulo="Con quién trabajamos">
        <p>
          No vendemos ni compartimos datos con nadie con fines comerciales. Para funcionar usamos
          estos proveedores, que guardan o procesan los datos por cuenta nuestra:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong className="text-ink-1">Supabase</strong>: la base de datos y el inicio de sesión.
          </li>
          <li>
            <strong className="text-ink-1">Vercel</strong>: el alojamiento del sitio y las copias de
            seguridad.
          </li>
          <li>
            <strong className="text-ink-1">Resend</strong>: el envío de las copias de seguridad al mail
            de TOQA.
          </li>
          <li>
            <strong className="text-ink-1">Google</strong>: el inicio de sesión con Google, para quien
            lo elige.
          </li>
        </ul>
        <p>Estos servicios pueden guardar los datos en servidores fuera de la Argentina.</p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo los guardamos">
        <p>
          Los registros de escaneos, mientras exista la placa. Las cuentas del panel, hasta que se den
          de baja. Si una cuenta se elimina, sus datos se eliminan con ella. Si se elimina una placa,
          queda 30 días en una papelera, con sus escaneos, por si hay que recuperarla, y después se
          elimina definitivamente. Las copias de
          seguridad de la lista de placas guardan versiones anteriores, así que una placa eliminada
          puede seguir figurando en copias viejas hasta que se borren. El registro de quién hizo
          cada cosa en el panel se conserva aunque la placa se elimine, para que quede constancia de
          quién la eliminó.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>
          Podés pedirnos ver, corregir o eliminar tus datos escribiendo a{" "}
          <strong className="text-ink-1">{CONTACTO}</strong>, según la Ley 25.326 de Protección de los
          Datos Personales.
        </p>
        <p className="text-xs text-ink-3">
          La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley
          N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes
          resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de
          protección de datos personales.
        </p>
      </Seccion>

      <Seccion titulo="Cambios">
        <p>
          Si cambiamos esta política, la publicamos en esta misma página con la fecha de
          actualización.
        </p>
      </Seccion>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-ink-1">{titulo}</h2>
      {children}
    </section>
  );
}
