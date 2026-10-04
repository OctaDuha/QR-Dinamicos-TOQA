/**
 * A donde mandar a alguien despues de entrar.
 *
 * Solo caminos de este mismo sitio. "//otro.com" o "/\otro.com" empiezan con
 * barra pero los navegadores los leen como otro dominio: un link de login
 * armado asi mandaria a la persona afuera justo despues de entrar.
 */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}
