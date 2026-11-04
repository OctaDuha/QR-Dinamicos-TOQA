-- ------------------------------------------------------------------
-- Bot de WhatsApp: reconocer a un cliente que escribe con su nombre de
-- usuario y el número oculto.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada y no cambia ningún QR ni ningún cliente.
--
-- Requiere haber corrido antes 2026-10-bot-whatsapp.sql.
--
-- Cómo funciona:
--   - Cuando alguien escribe mostrando su número, WhatsApp manda también su
--     identificador de usuario (BSUID, como "AR.1349…"). El bot anota el par
--     identificador ↔ número.
--   - Si después esa persona escribe con el número oculto, llega solo el
--     identificador: el bot busca el número que ya conocía y la atiende como
--     siempre (si es cliente, ve Estadísticas y recibe su reporte).
--   - Como el resto del bot, solo se usa con la llave del bot. Nadie más
--     puede leer ni escribir esta tabla.
-- ------------------------------------------------------------------

create table if not exists public.bot_usuarios (
  user_id     text primary key check (length(user_id) between 3 and 140),
  telefono    text not null check (telefono ~ '^\d{6,20}$'),
  visto_en    timestamptz not null default now()
);

alter table public.bot_usuarios enable row level security;
-- Sin políticas: solo se entra por las funciones de abajo, con la llave.

-- Anota (o actualiza) el número de un identificador.
create or replace function public.bot_vincular_usuario(p_llave text, p_user_id text, p_telefono text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.bot_llave_valida(p_llave) then
    raise exception 'Llave del bot inválida';
  end if;
  if p_user_id is null or length(p_user_id) not between 3 and 140
     or p_telefono is null or p_telefono !~ '^\d{6,20}$' then
    return;
  end if;

  insert into public.bot_usuarios (user_id, telefono, visto_en)
  values (p_user_id, p_telefono, now())
  on conflict (user_id) do update set telefono = excluded.telefono, visto_en = excluded.visto_en;
end;
$$;

revoke all on function public.bot_vincular_usuario(text, text, text) from public;
grant execute on function public.bot_vincular_usuario(text, text, text) to anon, authenticated;

-- El número que corresponde a un identificador, o null si no se conoce.
create or replace function public.bot_telefono_de_usuario(p_llave text, p_user_id text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.bot_llave_valida(p_llave) then
    raise exception 'Llave del bot inválida';
  end if;
  return (select u.telefono from public.bot_usuarios u where u.user_id = p_user_id);
end;
$$;

revoke all on function public.bot_telefono_de_usuario(text, text) from public;
grant execute on function public.bot_telefono_de_usuario(text, text) to anon, authenticated;
