# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TOQA (toqaqr.com.ar) sells plaques and vinyls with a printed QR code and an NFC chip. This repo is the whole product: the public redirect that every printed plaque points to, a private panel to manage plaques, clients and print-ready PDFs, a public landing page, and a WhatsApp bot. Stack: Next.js 15 (App Router, React 19), Supabase (Postgres + Auth), Vercel, Tailwind 4.

**Read `docs/ESTADO.md` first.** It holds the current state of the project: what is in progress (the Meta / WhatsApp Tech Provider process), pending tasks, account IDs, product decisions and the owner's working rules. Update it whenever any of that changes.

## Commands

```bash
npm run dev         # local dev server
npm run typecheck   # tsc --noEmit
npm run build       # production build (prebuild copies the pdf.js worker into public/)
```

There is no test suite and no lint script. Verify changes with `typecheck` and `build`, and for UI changes drive the built app with Playwright. Chromium lives at `/opt/pw-browsers/chromium`.

Never test against production data. `docs/ESTADO.md` §7 describes the local stack used before: Postgres + PostgREST + a fake Supabase Auth + a fake Graph API through `WHATSAPP_API_BASE`.

`NEXT_PUBLIC_*` variables are baked in at build time. See `.env.example` for the full list.

## Working with the owner

- The owner is non-technical and writes in Rioplatense Spanish. Everything they see — UI text, bot messages, explanations — uses that register ("vos", "tocá", "escaneá").
- Code identifiers and comments are in Spanish too, and comments explain *why*. Match that.
- Pushing the working branch deploys straight to production on Vercel. Commit freely, but push only after the owner OKs it. For visible changes, show screenshots before publishing.
- Don't start implementing a proposal until the owner explicitly says go.
- Never use or ask for the Supabase `service_role` key, and never ask the owner to paste a secret, token or key into chat.

## Architecture

### Printed URLs are permanent

A printed plaque can't be corrected, so every URL form that was ever printed keeps working forever:

| Form | Counts as |
|---|---|
| `/qr/0042` | QR |
| `/nfc/0042` | NFC |
| `/0042` (`src/app/[code]`) | QR (`?n` → NFC) |
| `/r/42` | QR |

- All of them share `src/lib/redirect-qr.ts`.
- `/0042` exists without `/r/` because the shorter URL drops the QR from 29×29 to 25×25 modules.
- Unknown or unreachable codes go to `QR_FALLBACK_URL`.
- Never change `NEXT_PUBLIC_SITE_URL`: it is encoded in every printed QR.
- Plaque numbers are never reused, even after deletion (`sync_qr_id_sequence`).

### Supabase: RLS is the authority

- The app only uses the anon key plus the user's session. Permissions live in Postgres policies (`es_dueno()`, `es_miembro()`) and `SECURITY DEFINER` functions; the UI only hides what would fail anyway.
- Roles in `src/lib/roles.ts` (`sesionActual()`):
  - `dueno`: owner.
  - `empleado`: shown as "Equipo" in the UI.
  - `pendiente`: a new account waiting for approval.
- Deleting is owner-only.
- `supabase/schema.sql` is the idempotent base schema.
- Each feature adds a file in `supabase/migraciones/`, which the owner runs by hand in the Supabase SQL Editor. Code must keep working when a migration hasn't been run yet. Detect that through PostgREST/Postgres error codes (`PGRST202`, `PGRST205`, `42P01`, `42703`) and show "falta correr la migración X" instead of breaking.
- Triggers on `qr_codes` do the bookkeeping:
  - history (`anotar_cambio_qr`)
  - the 30-day trash (`guardar_en_papelera`, recovered with `recuperar_placas`)
- `src/lib/respaldo-auto.ts` writes a CSV backup to Vercel Blob after every change, via `after()`.

### WhatsApp bot

- `src/app/api/whatsapp/route.ts`:
  - verifies Meta's signature (`WHATSAPP_APP_SECRET`);
  - answers immediately and handles the message in `after()`;
  - ignores notices for any phone id other than `WHATSAPP_PHONE_ID`.
- Logic: `src/lib/bot.ts`. Owner-editable texts: `src/lib/bot-textos.ts`. Graph API calls: `src/lib/whatsapp.ts`.
- The bot never uses `service_role`. It authenticates with `BOT_LLAVE`, which the owner generates in the panel; the database stores only its hash, and the bot's anon-callable `bot_*` functions require it.
- Interactive list titles are limited to 24 characters, emojis included.
- `smb_message_echoes` (replies sent from the phone app) silence the bot for 12 hours with that number.
- WhatsApp usernames: a user can write without showing their number. Then the webhook carries their business-scoped user id (BSUID, like `AR.1349…`) in `from` / `from_user_id` / `contacts[].user_id`, and replies go in `recipient` instead of `to` (`esUsuarioSinNumero`, `mandar` in `whatsapp.ts`). The database only stores digits (≤ 20) per conversation, so `claveBot()` turns a BSUID into `"00"` + 18 digits from its hash; the panel shows those as "Número oculto". Such users are never matched to clients, so they get the non-client menu.
- The owner's real number is being connected through Embedded Signup coexistence (`ConectarWhatsapp.tsx`). The number must **not** be registered through the API, because that would remove it from the phone app.

### Print-ready plaques

`src/lib/placa.ts` (pdf-lib) stamps a vector QR and the plaque number onto each design's background PDF.

- **Printer templates are the source of truth** (since 4/11/2026). The printer sends Illustrator PDFs in CMYK, all vector, with bleed, crop marks and a TrimBox inside the MediaBox (10×10 round vinyls with a magenta cut circle; 10×20 plaques = the 10×15 design plus 5 cm blank). `plantilla-imprenta.ts` (`cajaDeCorte`) recognises them by that TrimBox, and then:
  - the page is output exactly as sent: same size, with its TrimBox, BleedBox and ArtBox, no scaling, no extra margin and no cut line of ours;
  - uploading or replacing one never flattens or resizes it;
  - `layout.imprenta` (the trim box in mm) is computed by the server from the stored PDF on every upload, replace and save; the browser only uses it to show the cut piece.
- Everything the page draws is CMYK: QR and number in K 100 %, white boxes 0 %. Never RGB.
- Layout coordinates are in mm from the top-left of the background page (the MediaBox, so in templates they include the bleed and marks area).
- Positions are auto-detected in the browser: `detect-qr.ts` with pdf.js + jsQR, and `detect-circulo.ts` (Canva vinyls only).
  - The sample number is re-rendered at ~160 px tall. Its first digit (always a "0") picks the font by shape and gives the exact body size; the gap to the second "0" gives the letter spacing (`numberSpacingMm`).
  - The number is placed by ink: digit tops at `numberYMm`, ink centred on `numberXMm`.
- The number fonts live in `fuentes-numero.ts` and `src/assets/fuentes` (all SIL OFL): Noto Sans Bold (Canva designs), Calibri Bold via its free clone Carlito (printer's round vinyls) and Lato Semibold (printer's plaques). The browser loads them from `/api/placa/fuente/[id]` to recognise the font.
- The number is drawn as glyph outlines (`@pdf-lib/fontkit`), never as text, because the printer's machines don't recognise fonts. Output PDFs must contain no fonts.
- Legacy Canva designs (no TrimBox) keep the old path:
  - square ones are output as circles: scaled so the colour ring ends 1 mm inside a cut equal to the page side, a `CutContour` spot-colour cut line and a 2 mm sheet margin;
  - rectangular ones get a 3 mm white margin (`DEMASIA_MM`) and a rectangular `CutContour` line;
  - they are flattened in the browser on upload by default (`aplanar-pdf.ts`, 400 dpi JPEG, which is RGB).
- A design's background can be replaced in place (`POST /api/placa/designs/[id]/file`), keeping its id and the numbers already tied to it. With a template, the browser re-detects the QR, number and font right after.
- `placa-layout.ts` holds the layout type and helpers that the browser uses. `placa.ts` reads fonts from disk, so it is server-only.
- One PDF per plaque is the ZIP option.

### Statistics images

`src/lib/reporte-imagen.tsx` renders the PNG report with `next/og`, using fonts read from `src/assets/fuentes`. Every route that renders it, or that renders plaques (the number outlines read the same fonts), must be listed in `outputFileTracingIncludes` in `next.config.ts`.

### Gotchas

- An unlayered `a { color: inherit }` in `globals.css` beats Tailwind colour utilities on links, so link colours use inline `style`.
- Forms that must keep their values after an error submit by hand (`startTransition(() => formAction(new FormData(form)))`) instead of `action={…}`, which makes React 19 reset them.
- Normalise textarea values with `.replace(/\r\n?/g, "\n")` before comparing them.

## Docs

- `docs/ESTADO.md`: status, pending tasks and decisions. Start here.
- `docs/MANUAL.md`: what each screen of the site and panel is for, in the owner's words. Keep it in sync when screens change.
- `README.md` (Spanish): detailed reference for each feature and why it works the way it does.
- `PROBAR.md`: browser-only setup guide written for the owner.
