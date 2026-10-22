# Estado del proyecto TOQA

Resumen de lo decidido y lo pendiente, para retomar sin tener que releer meses de conversación. Para qué sirve cada pantalla del sitio está en el [MANUAL](MANUAL.md), y el *cómo* funciona por dentro, en el [README](../README.md). Acá va el *qué*, el *por qué* y *dónde estamos*.

Última actualización: 18/10/2026.

---

## 1. Quién y qué

- **TOQA** (marca; Instagram `toqa.nfc`, mail `toqa.nfc@gmail.com`, frase "Un toque. Una acción.") vende placas, vinilos y stickers con **código QR impreso + chip NFC** para comercios: reseñas de Google, Instagram, WhatsApp, menús, etc.
  - Los productos se entregan **ya configurados**: el cliente no toca nada.
  - Hay modelos genéricos y diseños personalizados.
- El **dueño** es una sola persona, sin conocimientos técnicos. Todo se le explica paso a paso, en castellano rioplatense, con capturas.
  - Además maneja campañas de Meta Ads para otros clientes. **Nada de lo que se configure en Meta para TOQA puede tocar los activos ni los portfolios de esos clientes.**
- **Sitio:** `https://toqaqr.com.ar`.
  - Página de inicio pública.
  - Panel privado en `/dashboard`.
  - Redirecciones de las placas en `/qr/0001`, `/nfc/0001`, `/0001` y `/r/1`.

## 2. Cómo trabajar con el dueño

Reglas que pidió explícitamente:

1. **No empezar a implementar sin su OK.** Primero se explica la propuesta y se espera el "dale".
2. **No publicar sin su OK.** Hacer push a la rama de trabajo **publica en producción** (Vercel). Para cambios visibles, mostrar capturas antes.
3. **"No rompas nada de lo que venimos trabajando."** Probar todo antes de publicar.
4. **Nunca usar ni pedir la clave `service_role` de Supabase.**
5. **Nunca pedir que pegue en el chat nada que diga Secret, token o key.** Alcanza con que diga "ya lo copié".
6. **Pasos cortos y concretos.** Decir dónde tocar, qué copiar y qué va a ver. Si algo de la pantalla no coincide, que mande captura.
7. **Explicar los riesgos de lo irreversible antes de hacerlo:** decisiones en Meta, borrar cosas, cambiar URLs impresas.

## 3. Infraestructura y cuentas

No hay secretos en este archivo. Los identificadores de abajo no son claves.

| Pieza | Datos |
|---|---|
| Código | GitHub `OctaDuha/QR-Din-micos-TOQA`. La rama `claude/new-session-90xuc9` es la que publica Vercel en producción. |
| Hosting | Vercel. Crons en `vercel.json`: keepalive diario y mail de respaldo diario. |
| Base | Supabase, proyecto `qr-toqa`, región **sa-east-1 (São Paulo)**, plan gratuito. El dueño corre a mano las migraciones de `supabase/migraciones/` en el SQL Editor. |
| Login | Usuario/contraseña y Google. El registro público está apagado en Supabase. Las cuentas nuevas entran solo por invitación del dueño y quedan "pendientes" hasta que las aprueba. |
| Respaldo | CSV en Vercel Blob en cada cambio, más un mail diario con el CSV adjunto (Resend → Gmail del dueño, con un filtro que lo etiqueta). Si la copia o el mail tienen más de 7 días, el panel los marca en rojo. |
| Verificación en dos pasos | **Activada** (19/10/2026) en todas las cuentas clave: Gmail, Facebook/Meta, GitHub, Vercel y Supabase. |
| Monitor | UptimeRobot revisa `https://toqaqr.com.ar/api/health` y avisa por mail si la página no responde. |
| Dominio | `toqaqr.com.ar` en NIC Argentina, con renovación anual. Si se vence, todas las placas dejan de funcionar. Hay que renovarlo en los 30 días previos al vencimiento. |

Las variables de entorno están documentadas en `.env.example`.

### Meta / WhatsApp

| Qué | Valor |
|---|---|
| Portfolio comercial | `toqa.nfc` (ID 1466992878784395). **Verificado el 16/10/2026** como persona física/monotributo del dueño, con nombre alternativo "TOQA". La verificación salió por **identidad (DNI)**: el registro público de Meta tenía un teléfono viejo que no era suyo. |
| App de Meta | **TOQA Bot**, ID `1138106575564279`, tipo empresa. **Marcada como proveedor de tecnología**, decisión irreversible y correcta. |
| Configuración de registro insertado | ID `2363042957797849`. Plantilla "registro insertado de WhatsApp con token de 60 días": el token se usa una sola vez, al conectar. |
| Número de prueba (bot actual) | +1 555-666-9190, phone id `1297383330136006`, cuenta de WhatsApp `2110399713184006`. |
| Número real a conectar | **+54 9 11 2243-4691**: el WhatsApp Business de TOQA, que el dueño usa en el celular. |
| Token | Usuario del sistema con token permanente (`WHATSAPP_TOKEN` en Vercel). |
| Webhook | `https://toqaqr.com.ar/api/whatsapp`. Hoy está suscrito el campo `messages`. |
| Configuración básica de la app | Dominio `toqaqr.com.ar`, política de privacidad y eliminación de datos en `/privacidad`, ícono cargado y plataforma Sitio web. |
| Inicio de sesión con Facebook para empresas | SDK de JavaScript activado. Dominio permitido `https://toqaqr.com.ar/`. Redirect `https://toqaqr.com.ar/dashboard/whatsapp`. |

## 4. Dónde estamos: pasar el bot al número real

**Restricciones del dueño:** sin intermediarios pagos, sin dos números, y la app WhatsApp Business del celular tiene que seguir andando. El único camino que cumple las tres es la **coexistencia** mediante el **registro insertado**, para lo cual hay que ser **proveedor de tecnología**.

| Paso | Estado |
|---|---|
| Verificación del negocio | ✅ 16/10 |
| Proveedor de tecnología (marcado) | ✅ |
| Pruebas de los permisos (llamadas a la API) | ✅ Valen 30 días: hay que enviar y aprobar antes de mediados de noviembre o rehacerlas con el explorador (`GET 2110399713184006/phone_numbers` con permiso `whatsapp_business_management`). |
| Verificación de acceso | ⏳ Enviada el 17/10. Plazo de unos 5 días hábiles. |
| Revisión de la app | ⏳ Enviada el 18/10. Plazo de hasta 20 días. |
| Publicar la app | Pendiente de las dos aprobaciones. |
| Conectar el número real | Pendiente. El botón ya está en Panel → WhatsApp. |

**Lo que se mandó en la revisión de la app**, todo en inglés:
- **Permisos:** `whatsapp_business_messaging`, `whatsapp_business_management` y `public_profile`.
- **Videos:**
  - `video1-mensajes-bot`: desde un WhatsApp personal se escribe "menú", llega el menú, se elige Estadísticas y llega el reporte en imagen.
  - `video2-plantilla`: en WhatsApp Manager se crea la plantilla `aviso_estadisticas`, de categoría Utilidad. Se creó **solo para el video**: no se usa y se puede borrar después de la aprobación.
- **Tratamiento de datos:**
  - Encargados: Vercel Inc. (EE. UU.) y Supabase Inc. (Brasil y EE. UU.), los dos como "servicios de TI".
  - Responsable: el dueño, en Argentina.
  - Pedidos de autoridades: no hubo. Se marcaron las 4 políticas.
- **Instrucciones para revisores:** el panel es privado y por eso no se dieron credenciales. El inicio de sesión con Facebook se usa solo dentro del panel, por el dueño, para el registro insertado.

**Cuando Meta apruebe todo**, en este orden:

1. **Publicar la app.** Pasa a modo activo.
2. **Conectar el número.** Panel → WhatsApp → **Conectar mi WhatsApp Business**: se escanea un QR con el celular y se hace **una sola vez**. El panel muestra el phone id, el número y la cuenta de WhatsApp.
3. **Asignar la cuenta al usuario del sistema.** Meta Business → Usuarios del sistema → Asignar activos → la nueva cuenta de WhatsApp, con **control total**.
4. **Suscribir `smb_message_echoes`** en los campos del webhook. Es lo que calla al bot cuando responde una persona desde el celular.
5. **Actualizar Vercel.** Cambiar `WHATSAPP_PHONE_ID` y `WHATSAPP_NUMERO` y hacer Redeploy. Hasta ese momento, el webhook ignora los mensajes del número nuevo, así que nadie recibe respuestas a medias.
6. **Probar** desde otro celular.

**Cuidados de la coexistencia:**
- **No registrar el número por API**: lo sacaría de la app del celular.
- Hay que abrir la app del celular al menos una vez cada 14 días.
- Se pierden algunas funciones de la app, como las listas de difusión y los mensajes "ver una vez".

**Si Meta rechaza o pide cambios:** leer el motivo, corregir y reenviar. La verificación del negocio tiene un plan B si alguna vez hace falta rehacerla: "Mi negocio no aparece" + constancia de ARCA + factura con el domicilio fiscal, o la verificación del dominio con una etiqueta meta en el sitio.

## 5. Otros pendientes

- **Fotos reales de productos** para la página de inicio. El dueño las va a mandar; hoy hay ilustraciones.
- **Domicilio fiscal en ARCA:** el dueño se mudó y el domicilio fiscal quedó viejo. Actualizarlo es trámite suyo, y conviene hacerlo **después** de que Meta termine las revisiones, para no generar diferencias mientras revisan.
- La tarjeta "QR y NFC en uno" de la página de inicio sigue diciendo "funciona con cualquier celular". El dueño pidió **no cambiarla** por ahora, aunque el NFC funciona en alrededor del 90 % de los celulares.

## 6. Decisiones de producto, y por qué

- **El bot no manda estadísticas por su cuenta.** Los clientes las piden si les interesan. El dueño decidió no hacer envíos automáticos, que además se cobran.

- **Las URLs impresas no cambian nunca.**
  - `/0001` en vez de `/r/0001` achica el QR de 29×29 a 25×25 módulos.
  - `/qr/` y `/nfc/` se agregaron para contar por separado los escaneos de QR y los toques de NFC.
  - Las formas viejas siguen andando.
  - Los números de placa no se reutilizan nunca.
- **El chip NFC** se graba con `https://toqaqr.com.ar/nfc/XXXX` (con la app NFC Tools) y después se bloquea. Nunca se graba el destino final del cliente.
- **Estadísticas:**
  - Gráficos por día, semana y mes, con el total separado en QR y NFC.
  - Rango de fechas libre.
  - El reporte para el cliente es una **imagen**, no un CSV: se descarga o se comparte por WhatsApp. El CSV queda como opción secundaria.
- **Historial y papelera:**
  - Cada placa tiene su historial en "Editar", y hay una lista general solo para el dueño.
  - Las placas borradas quedan **30 días** en la papelera, con botón "Recuperar" dentro de Historial.
- **Roles:**
  - Dueño y "Equipo" (en la base sigue llamándose `empleado`).
  - Borrar es solo del dueño, y lo hace cumplir la base de datos.
- **Clientes:**
  - Los datos del cliente (negocio, contacto, WhatsApp) se cargan en "Editar" de cada placa.
  - Desde la ficha del cliente se configuran sus placas y se ven sus estadísticas sin salir de la pantalla.
- **Bot de WhatsApp** (propio y gratuito, sin ManyChat):
  - En una conversación nueva (12 horas sin hablar) responde con un menú, sea lo que sea que escriba el cliente: 🛒 Quiero un producto / 📊 Estadísticas / ❓ ¿Cómo funciona TOQA? / 🔧 Tengo un problema / 💬 Hablar con nosotros.
  - Estadísticas y "Tengo un problema" se les ofrecen solo a clientes cargados.
  - En medio de una charla no se mete. "menú" o "estadísticas" lo llaman siempre.
  - Los textos se editan desde el panel.
  - Si piden hablar con una persona, o si el dueño responde desde el celular, se calla 12 horas con ese número.
  - Después de "Quiero un producto" o "Tengo un problema", al primer mensaje del cliente le avisa una vez "¡Perfecto! En breve te responderá una persona del equipo 🙌" (pedido del dueño el 22/10), salvo que el dueño ya haya respondido.
- **Página de inicio:**
  - Pública y permanente. Quien tiene sesión iniciada va directo al panel.
  - Colores: azul `#223f84` y naranja `#fa8632`.
  - El cartel de muestra está dibujado como las placas reales: NFC a la izquierda y QR real a la derecha.
  - Los íconos de contacto son de Simple Icons (CC0).
  - Las imágenes de productos hechas con IA se descartaron.
- **Placas para imprenta:**
  - Las placas rectangulares (10×15) salen tal cual.
  - Los **diseños cuadrados (vinilos de 10×10) salen redondos**, todos de **10 cm**: el aro de color se ajusta solo para terminar a 1 mm del corte (una franja blanca pareja en todos), con línea de corte `CutContour` y 2 mm de margen.
  - Va un PDF por vinilo (opción ZIP).
  - Para la imprenta: "línea de corte en CutContour, con 2 mm de sangrado".

## 7. Probar sin tocar producción

En las sesiones en la nube se probó todo con:
- un Postgres 16 local con el esquema y las migraciones;
- PostgREST 12;
- un servidor falso de Auth de Supabase (que deja pasar las llamadas REST a PostgREST);
- una Graph API de Meta falsa (`WHATSAPP_API_BASE` apunta a ella);
- `next build` + `next start` y Playwright.

Esos scripts vivían en el espacio temporal de la sesión y no se guardaron. Si hace falta, se rearman con esa receta. Para la ventana de Meta del registro insertado, Playwright intercepta `connect.facebook.net` y `www.facebook.com` con versiones falsas.
