import Image from "next/image";
import Link from "next/link";

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
                escanean, y llegan a tus reseñas de Google, tu Instagram, tu menú o tu WhatsApp.
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
            Sin apps ni complicaciones: funciona con cualquier celular.
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
                Cada producto se diseña <strong style={{ color: TINTA }}>a la medida de tu negocio, marca o empresa</strong>:
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
              <Contacto titulo="WhatsApp" valor={WHATSAPP_VISIBLE} href={linkWhatsapp} />
              <Contacto titulo="Mail" valor={MAIL} href={`mailto:${MAIL}`} />
              <Contacto titulo="Instagram" valor={`@${INSTAGRAM}`} href={linkInstagram} />
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

function Contacto({ titulo, valor, href }: { titulo: string; valor: string; href: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer noopener"
      className="rounded-2xl border border-white/15 p-5 transition-colors hover:bg-white/5"
    >
      <span className="block text-sm text-white/60">{titulo}</span>
      <span className="mt-1 block font-semibold break-all">{valor}</span>
    </a>
  );
}

/** Ilustración de un cartel TOQA de mostrador (no es una foto). */
function Cartel() {
  return (
    <svg viewBox="0 0 320 380" className="h-auto w-64 sm:w-72" role="img" aria-label="Ilustración de un cartel TOQA para mostrador">
      <ellipse cx="160" cy="356" rx="120" ry="12" fill="#d9deea" />
      {/* Pie del atril */}
      <path d="M70 330 L250 330 L262 352 L58 352 Z" fill="#e7ebf3" stroke="#cfd6e6" />
      {/* Placa */}
      <rect x="62" y="30" width="196" height="304" rx="18" fill="#ffffff" stroke="#cfd6e6" strokeWidth="2" />
      <path d="M62 48 a18 18 0 0 1 18 -18 h160 a18 18 0 0 1 18 18 v42 H62 Z" fill={AZUL} />
      <text x="160" y="70" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700" letterSpacing="6">
        TOQA
      </text>
      <circle cx="207" cy="64" r="3" fill={NARANJA} />
      <text x="160" y="122" textAnchor="middle" fill={TINTA} fontSize="15" fontWeight="600">
        Dejanos tu reseña
      </text>
      {/* Celular con ondas */}
      <g transform="translate(160 190)">
        <path d="M-46 -40 v-10 h12 M46 -40 v-10 h-12 M-46 40 v10 h12 M46 40 v10 h-12" stroke={TINTA} strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="-14" y="-30" width="34" height="58" rx="7" fill="none" stroke={TINTA} strokeWidth="3" />
        <path d="M-24 -12 a16 16 0 0 0 0 22 M-32 -20 a28 28 0 0 0 0 38" stroke={NARANJA} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <text x="160" y="268" textAnchor="middle" fill={TINTA} fontSize="16" fontWeight="700">
        Apoyá tu celular
      </text>
      <text x="160" y="290" textAnchor="middle" fill={TINTA_2} fontSize="12">
        o escaneá el código
      </text>
      {/* Mini QR decorativo */}
      <g transform="translate(140 300)" fill={TINTA}>
        <rect x="0" y="0" width="8" height="8" />
        <rect x="32" y="0" width="8" height="8" />
        <rect x="0" y="16" width="8" height="8" />
        <rect x="12" y="6" width="4" height="4" />
        <rect x="20" y="2" width="4" height="4" />
        <rect x="24" y="14" width="4" height="4" />
        <rect x="16" y="18" width="4" height="4" />
        <rect x="32" y="18" width="4" height="4" />
      </g>
    </svg>
  );
}
