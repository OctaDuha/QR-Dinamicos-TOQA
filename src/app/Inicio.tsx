import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";

/**
 * La página pública de TOQA: lo que ve quien entra a toqaqr.com.ar sin estar
 * logueado (un posible cliente, o Meta cuando revisa la marca). Quien está
 * logueado sigue yendo directo al panel.
 */

const AZUL = "#223f84";
const AZUL_OSCURO = "#172c5f";
const NARANJA = "#fa8632";
const TINTA = "#16213f";
const TINTA_2 = "#4a5577";

const WHATSAPP = "5491122434691";
const WHATSAPP_VISIBLE = "+54 9 11 2243-4691";
const MAIL = "toqa.nfc@gmail.com";
const INSTAGRAM = "toqa.nfc";

const linkWhatsapp = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("¡Hola! Quiero info sobre los productos TOQA.")}`;
const linkInstagram = `https://www.instagram.com/${INSTAGRAM}/`;

export function Inicio() {
  return (
    <div style={{ background: "#ffffff", color: TINTA }} className="min-h-screen">
      <header style={{ background: AZUL }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <span className="text-xl font-bold tracking-[0.3em] text-white">
            TOQA<span style={{ color: NARANJA }}>.</span>
          </span>
          <nav className="flex items-center gap-5 text-sm text-white/80">
            <a href="#como-funciona" className="hidden hover:text-white sm:inline">
              Cómo funciona
            </a>
            <a href="#productos" className="hidden hover:text-white sm:inline">
              Productos
            </a>
            <a href="#contacto" className="hover:text-white">
              Contacto
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Portada */}
        <section style={{ background: AZUL }}>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-10 pb-16 md:grid-cols-[1.2fr_1fr] md:pt-16 md:pb-24">
            <div>
              <h1 className="text-4xl leading-tight font-bold text-white sm:text-5xl">
                Un <span style={{ color: NARANJA }}>toque</span>. Una <span style={{ color: NARANJA }}>acción</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">
                Placas y productos con <strong className="text-white">código QR</strong> y{" "}
                <strong className="text-white">chip NFC</strong> para tu negocio: tus clientes apoyan el celular o
                escanean, y llegan a tus reseñas de Google, tu Instagram, tu WhatsApp, tu menú y mucho más.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={linkWhatsapp}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full px-6 py-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ background: NARANJA, color: "#ffffff" }}
                >
                  Escribinos por WhatsApp
                </a>
                <a
                  href={linkInstagram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-white/40 px-6 py-3 font-semibold transition-colors hover:bg-white/10"
                  style={{ color: "#ffffff" }}
                >
                  Ver Instagram
                </a>
              </div>
            </div>
            <div className="flex justify-center">
              <Image
                src="/marca/toqa-logo.jpg"
                alt="TOQA: Un toque. Una acción."
                width={360}
                height={360}
                priority
                className="h-auto w-64 rounded-full shadow-2xl sm:w-80"
              />
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="text-3xl font-bold">Cómo funciona</h2>
          <p className="mt-2 max-w-2xl" style={{ color: TINTA_2 }}>
            Sin apps ni complicaciones, el sistema de TOQA se encarga de todo.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            <Paso numero={1} titulo="Elegís a dónde lleva">
              Tus reseñas de Google, tu Instagram, tu menú, tu WhatsApp o la página que quieras.
            </Paso>
            <Paso numero={2} titulo="Tus clientes lo usan">
              Apoyan el celular sobre el producto (NFC) o escanean el código QR con la cámara. Al instante se abre tu
              link.
            </Paso>
            <Paso numero={3} titulo="Lo cambiás cuando quieras">
              El destino se puede cambiar en cualquier momento, sin reimprimir nada. Y podés ver cuánta gente lo usa.
            </Paso>
          </ol>
        </section>

        {/* Productos */}
        <section id="productos" style={{ background: "#f3f5fa" }}>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-20">
            <div className="flex justify-center">
              <Cartel />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Productos</h2>
              <p className="mt-3 leading-relaxed" style={{ color: TINTA_2 }}>
                Tenemos <strong style={{ color: TINTA }}>modelos listos para usar</strong> y también hacemos{" "}
                <strong style={{ color: TINTA }}>diseños personalizados a la medida para tu negocio, marca o empresa</strong>:
                con tu logo, tus colores y tu estilo, para que se vea como parte de tu local y no como un cartel más.
              </p>
              <ul className="mt-6 flex flex-col gap-5">
                <Producto titulo="Placas para mostrador y mesas">
                  Para sumar reseñas en Google, seguidores en Instagram o mostrar tu menú.
                </Producto>
                <Producto titulo="Vinilos y stickers">
                  Para vidrieras, mesas, cajas o donde tus clientes miren.
                </Producto>
                <Producto titulo="Otros formatos">
                  ¿Tenés otra idea, otro tamaño o un pedido para varias sucursales? Contanos qué necesitás y lo armamos.
                </Producto>
              </ul>
            </div>
          </div>
        </section>

        {/* Ventajas */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="text-3xl font-bold">Por qué TOQA</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Ventaja titulo="Un toque y listo">Más rápido que buscarte o escribir una dirección.</Ventaja>
            <Ventaja titulo="QR y NFC en uno">Con el chip o con la cámara: funciona con cualquier celular.</Ventaja>
            <Ventaja titulo="Destino editable">¿Cambiaste de link? Lo actualizamos sin reimprimir.</Ventaja>
            <Ventaja titulo="Estadísticas">Sabés cuántas personas lo usaron y por dónde entraron.</Ventaja>
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" style={{ background: AZUL_OSCURO }}>
          <div className="mx-auto max-w-6xl px-5 py-16 text-white md:py-20">
            <h2 className="text-3xl font-bold">¿Querés el tuyo?</h2>
            <p className="mt-2 text-white/80">Escribinos y te pasamos opciones y precios.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Contacto titulo="WhatsApp" valor={WHATSAPP_VISIBLE} href={linkWhatsapp} icono="whatsapp" />
              <Contacto titulo="Mail" valor={MAIL} href={`mailto:${MAIL}`} icono="gmail" />
              <Contacto titulo="Instagram" valor={`@${INSTAGRAM}`} href={linkInstagram} icono="instagram" />
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: AZUL_OSCURO }} className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-white/60">
          <span>
            © {new Date().getFullYear()} TOQA · Un toque. Una acción.
          </span>
          <span className="flex gap-5">
            <Link href="/privacidad" className="hover:text-white">
              Privacidad
            </Link>
            <Link href="/login" className="hover:text-white">
              Entrar al panel
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border p-6" style={{ borderColor: "#e3e7f0" }}>
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
        style={{ background: NARANJA }}
        aria-hidden="true"
      >
        {numero}
      </span>
      <h3 className="mt-4 text-lg font-semibold">{titulo}</h3>
      <p className="mt-2 leading-relaxed" style={{ color: TINTA_2 }}>
        {children}
      </p>
    </li>
  );
}

function Producto({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: NARANJA }} aria-hidden="true" />
      <span>
        <span className="block text-lg font-semibold">{titulo}</span>
        <span style={{ color: TINTA_2 }}>{children}</span>
      </span>
    </li>
  );
}

function Ventaja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#f3f5fa" }}>
      <h3 className="font-semibold" style={{ color: AZUL }}>
        {titulo}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: TINTA_2 }}>
        {children}
      </p>
    </div>
  );
}

function Contacto({
  titulo,
  valor,
  href,
  icono,
}: {
  titulo: string;
  valor: string;
  href: string;
  icono: keyof typeof ICONOS;
}) {
  const { color, d } = ICONOS[icono];
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer noopener"
      aria-label={`${titulo}: ${valor}`}
      className="flex items-center gap-4 rounded-2xl border border-white/15 p-5 transition-colors hover:bg-white/5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill={color}>
          <path d={d} />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-white/60">{titulo}</span>
        <span className="mt-0.5 block font-semibold break-all">{valor}</span>
      </span>
    </a>
  );
}

/** Logos de cada medio, de Simple Icons (licencia CC0), con el color de su marca. */
const ICONOS = {
  whatsapp: { color: "#25D366", d: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" },
  gmail: { color: "#EA4335", d: "M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" },
  instagram: { color: "#E4405F", d: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" },
};

/** Los cuadraditos de un QR real (lleva a toqaqr.com.ar), como un solo trazo SVG. */
function caminoQr(texto: string, lado: number): string {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const m = lado / n;
  let d = "";
  for (let fila = 0; fila < n; fila++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.data[fila * n + col] === 1) {
        d += `M${(col * m).toFixed(2)} ${(fila * m).toFixed(2)}h${m.toFixed(2)}v${m.toFixed(2)}h-${m.toFixed(2)}z`;
      }
    }
  }
  return d;
}

/**
 * Ilustración de un cartel TOQA de mostrador, como los que se imprimen:
 * el chip NFC de un lado y el QR con su número del otro. No es una foto; el
 * QR es real y lleva a toqaqr.com.ar.
 */
function Cartel() {
  const LADO_QR = 96;
  return (
    <svg
      viewBox="0 0 320 390"
      className="h-auto w-64 sm:w-80"
      role="img"
      aria-label="Ilustración de un cartel TOQA para dejar reseñas, con chip NFC y código QR"
    >
      <ellipse cx="160" cy="370" rx="130" ry="11" fill="#d9deea" />
      {/* Pie del atril */}
      <path d="M56 342 L264 342 L276 362 L44 362 Z" fill="#e7ebf3" stroke="#cfd6e6" />
      {/* Placa */}
      <rect x="40" y="16" width="240" height="332" rx="18" fill="#ffffff" stroke="#cfd6e6" strokeWidth="2" />
      <path d="M40 34 a18 18 0 0 1 18 -18 h204 a18 18 0 0 1 18 18 v40 H40 Z" fill={AZUL} />
      <text x="160" y="54" textAnchor="middle" fill="#ffffff" fontSize="21" fontWeight="700" letterSpacing="6">
        TOQA
      </text>
      <circle cx="205" cy="49" r="3" fill={NARANJA} />
      <text x="160" y="106" textAnchor="middle" fill={TINTA} fontSize="18" fontWeight="700">
        Dejanos tu reseña
      </text>
      <text x="160" y="126" textAnchor="middle" fill={TINTA_2} fontSize="12">
        ¡Tu opinión nos importa!
      </text>

      {/* Izquierda: el chip NFC */}
      <g transform="translate(106 206)">
        <path
          d="M-44 -34 v-12 h14 M44 -34 v-12 h-14 M-44 34 v12 h14 M44 34 v12 h-14"
          stroke={TINTA}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle r="30" fill="none" stroke={TINTA} strokeWidth="2" />
        <rect x="-4" y="-21" width="24" height="40" rx="5" fill="#ffffff" stroke={TINTA} strokeWidth="2.5" />
        <path d="M-11 -9 a10 10 0 0 0 0 16 M-18 -15 a18 18 0 0 0 0 28" stroke={NARANJA} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <text x="8" y="3" textAnchor="middle" fill={TINTA} fontSize="7.5" fontWeight="700">
          NFC
        </text>
      </g>
      <text x="106" y="286" textAnchor="middle" fill={TINTA} fontSize="12.5" fontWeight="700">
        Apoyá tu celular
      </text>

      {/* Derecha: el QR con su número, como en las placas */}
      <g transform={`translate(${222 - LADO_QR / 2} 152)`}>
        <path d={caminoQr("https://toqaqr.com.ar", LADO_QR)} fill={TINTA} />
      </g>
      <text x="222" y="266" textAnchor="middle" fill={TINTA} fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace" letterSpacing="1.5">
        0001
      </text>
      <text x="222" y="286" textAnchor="middle" fill={TINTA} fontSize="12.5" fontWeight="700">
        Escaneá
      </text>

      <text x="160" y="326" textAnchor="middle" fill={TINTA_2} fontSize="9" fontWeight="600" letterSpacing="1">
        by TOQA.NFC
      </text>
    </svg>
  );
}
