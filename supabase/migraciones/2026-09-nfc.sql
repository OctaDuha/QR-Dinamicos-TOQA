-- ------------------------------------------------------------------
-- Separar los escaneos del QR de los toques del chip NFC.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez sin problema, y no toca ningún dato existente: los escaneos que
-- ya tenés quedan contados como "qr", que es lo que eran.
-- ------------------------------------------------------------------

-- 1. Dónde se guarda por dónde entró cada visita.
alter table public.scans
  add column if not exists via text not null default 'qr';

do $$
begin
  alter table public.scans add constraint scans_via_check check (via in ('qr', 'nfc'));
exception
  when duplicate_object then null;
end;
$$;

-- 2. La función que resuelve un escaneo, ahora sabiendo por dónde entró.
--
--    La versión vieja de dos argumentos se deja intacta: mientras se
--    despliega la versión nueva del sitio, la anterior la sigue llamando y
--    no se pierde ningún escaneo.
create or replace function public.resolve_qr(
  p_id         bigint,
  p_user_agent text,
  p_via        text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  select destination_url into v_url from public.qr_codes where id = p_id;

  if v_url is null then
    return null;
  end if;

  insert into public.scans (qr_id, user_agent, via)
  values (p_id, left(p_user_agent, 500), case when p_via = 'nfc' then 'nfc' else 'qr' end);

  return v_url;
end;
$$;

revoke all on function public.resolve_qr(bigint, text, text) from public;
grant execute on function public.resolve_qr(bigint, text, text) to anon, authenticated;
