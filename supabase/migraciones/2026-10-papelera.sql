-- ------------------------------------------------------------------
-- Papelera: una placa borrada queda guardada 30 días, con sus
-- estadísticas, y se puede recuperar desde Historial.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada y no cambia ningún QR.
--
-- Requiere haber corrido antes 2026-10-historial.sql.
--
-- Cómo funciona:
--   - Justo antes de borrar una placa, la base guarda una copia de la placa
--     y de todos sus escaneos. Pasa siempre, se borre desde donde se borre.
--   - Mientras está en la papelera, la placa está borrada de verdad: el QR y
--     el chip no llevan a ningún lado, y no figura en la lista ni en las
--     copias de seguridad.
--   - Recuperar la devuelve con el mismo número, destino, etiqueta, diseño,
--     fecha de creación y estadísticas. Solo lo puede hacer el dueño.
--   - A los 30 días se elimina definitivamente. Lo hace la base sola: cada
--     vez que se borra una placa, cuando el dueño abre Historial y una vez
--     por día con la tarea diaria del sitio.
-- ------------------------------------------------------------------

-- 1. Las tablas. La copia de los escaneos se borra sola con su placa.
create table if not exists public.papelera (
  qr_id             bigint primary key,
  label             text,
  destination_url   text not null,
  created_at        timestamptz not null,
  design_id         bigint,
  diseno_nombre     text,
  borrado_en        timestamptz not null default now(),
  borrado_por_id    uuid,
  borrado_por_email text
);

create index if not exists papelera_por_fecha on public.papelera (borrado_en desc);

create table if not exists public.papelera_escaneos (
  id         bigint primary key,
  qr_id      bigint not null references public.papelera (qr_id) on delete cascade,
  scanned_at timestamptz not null,
  user_agent text,
  via        text not null default 'qr'
);

create index if not exists papelera_escaneos_por_placa on public.papelera_escaneos (qr_id);

-- 2. Permisos: el dueño mira, nadie escribe directo. Solo escriben las
--    funciones de abajo.
alter table public.papelera enable row level security;
alter table public.papelera_escaneos enable row level security;

drop policy if exists papelera_leer on public.papelera;
create policy papelera_leer on public.papelera
  for select to authenticated using (public.es_dueno());

drop policy if exists papelera_escaneos_leer on public.papelera_escaneos;
create policy papelera_escaneos_leer on public.papelera_escaneos
  for select to authenticated using (public.es_dueno());

revoke all on public.papelera, public.papelera_escaneos from anon, authenticated;
grant select on public.papelera, public.papelera_escaneos to authenticated;

-- 3. Vaciar lo que pasó los 30 días. No hace otra cosa, así que la puede
--    llamar cualquiera: la tarea diaria del sitio la llama sin usuario.
create or replace function public.vaciar_papelera()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas integer;
begin
  delete from public.papelera where borrado_en < now() - interval '30 days';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke all on function public.vaciar_papelera() from public;
grant execute on function public.vaciar_papelera() to anon, authenticated;

-- 4. Antes de borrar una placa, guardarla con sus escaneos.
create or replace function public.guardar_en_papelera()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform public.vaciar_papelera();

  -- Si el número ya estaba en la papelera (se volvió a usar y se volvió a
  -- borrar), queda la copia más nueva.
  delete from public.papelera where qr_id = old.id;

  insert into public.papelera (
    qr_id, label, destination_url, created_at, design_id, diseno_nombre,
    borrado_por_id, borrado_por_email
  )
  values (
    old.id, old.label, old.destination_url, old.created_at, old.design_id,
    (select name from public.placa_designs where id = old.design_id),
    v_uid, (select email from public.perfiles where id = v_uid)
  );

  insert into public.papelera_escaneos (id, qr_id, scanned_at, user_agent, via)
  select s.id, s.qr_id, s.scanned_at, s.user_agent, s.via
  from public.scans s
  where s.qr_id = old.id;

  return old;
end;
$$;

drop trigger if exists guardar_en_papelera on public.qr_codes;
create trigger guardar_en_papelera
  before delete on public.qr_codes
  for each row execute function public.guardar_en_papelera();

-- 5. El historial distingue una placa recuperada de una creada.
alter table public.historial drop constraint if exists historial_accion_check;
alter table public.historial
  add constraint historial_accion_check
  check (accion in ('creo', 'edito', 'borro', 'imprimio', 'recupero'));

create or replace function public.anotar_cambio_qr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_cambios jsonb := '{}'::jsonb;
begin
  select email into v_email from public.perfiles where id = v_uid;

  if tg_op = 'INSERT' then
    insert into public.historial (qr_id, accion, cambios, usuario_id, usuario_email)
    values (
      new.id,
      case when current_setting('toqa.recuperando', true) = 'si' then 'recupero' else 'creo' end,
      jsonb_strip_nulls(jsonb_build_object(
        'destino', jsonb_build_object('despues', new.destination_url),
        'etiqueta', case when new.label is not null then jsonb_build_object('despues', new.label) end,
        'diseno', case when new.design_id is not null then jsonb_build_object(
          'despues', (select name from public.placa_designs where id = new.design_id)) end
      )),
      v_uid,
      v_email
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.historial (qr_id, accion, cambios, usuario_id, usuario_email)
    values (
      old.id,
      'borro',
      jsonb_strip_nulls(jsonb_build_object(
        'destino', jsonb_build_object('antes', old.destination_url),
        'etiqueta', case when old.label is not null then jsonb_build_object('antes', old.label) end
      )),
      v_uid,
      v_email
    );
    return old;
  end if;

  if new.destination_url is distinct from old.destination_url then
    v_cambios := v_cambios || jsonb_build_object('destino',
      jsonb_build_object('antes', old.destination_url, 'despues', new.destination_url));
  end if;
  if new.label is distinct from old.label then
    v_cambios := v_cambios || jsonb_build_object('etiqueta',
      jsonb_build_object('antes', old.label, 'despues', new.label));
  end if;
  if new.design_id is distinct from old.design_id then
    v_cambios := v_cambios || jsonb_build_object('diseno', jsonb_build_object(
      'antes', case when old.design_id is not null then coalesce(
        (select name from public.placa_designs where id = old.design_id), 'un diseño ya borrado') end,
      'despues', case when new.design_id is not null then coalesce(
        (select name from public.placa_designs where id = new.design_id), 'un diseño ya borrado') end));
  end if;

  if v_cambios <> '{}'::jsonb then
    insert into public.historial (qr_id, accion, cambios, usuario_id, usuario_email)
    values (new.id, 'edito', v_cambios, v_uid, v_email);
  end if;
  return new;
end;
$$;

-- 6. Recuperar. Devuelve, por cada número pedido, cómo le fue:
--    'ok', 'en-uso' (otra placa ya tiene ese número) o 'no-esta' (no está
--    en la papelera, o ya pasaron los 30 días).
create or replace function public.recuperar_placas(p_ids bigint[])
returns table (qr_id bigint, resultado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_p  public.papelera%rowtype;
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede recuperar placas';
  end if;

  perform public.vaciar_papelera();

  foreach v_id in array coalesce(p_ids[1:1000], '{}') loop
    select * into v_p from public.papelera p where p.qr_id = v_id;

    if not found then
      qr_id := v_id; resultado := 'no-esta'; return next; continue;
    end if;
    if exists (select 1 from public.qr_codes q where q.id = v_id) then
      qr_id := v_id; resultado := 'en-uso'; return next; continue;
    end if;

    perform set_config('toqa.recuperando', 'si', true);
    insert into public.qr_codes (id, label, destination_url, created_at, design_id)
    values (
      v_p.qr_id, v_p.label, v_p.destination_url, v_p.created_at,
      (select d.id from public.placa_designs d where d.id = v_p.design_id)
    );
    perform set_config('toqa.recuperando', '', true);

    insert into public.scans (id, qr_id, scanned_at, user_agent, via)
    select e.id, e.qr_id, e.scanned_at, e.user_agent, e.via
    from public.papelera_escaneos e
    where e.qr_id = v_id;

    delete from public.papelera p where p.qr_id = v_id;

    qr_id := v_id; resultado := 'ok'; return next;
  end loop;
end;
$$;

revoke all on function public.recuperar_placas(bigint[]) from public;
grant execute on function public.recuperar_placas(bigint[]) to authenticated;

-- 7. Un número que ya se usó no se vuelve a dar a una placa nueva, aunque
--    esa placa esté en la papelera o ya se haya eliminado: puede haber una
--    placa impresa con ese número. Antes, después de importar un CSV, la
--    numeración podía volver para atrás si se habían borrado las últimas.
create or replace function public.sync_qr_id_sequence()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max bigint;
begin
  select greatest(
    (select coalesce(max(id), 0) from public.qr_codes),
    (select coalesce(max(qr_id), 0) from public.papelera),
    (select coalesce(max(qr_id), 0) from public.historial)
  ) into v_max;
  perform setval(pg_get_serial_sequence('public.qr_codes', 'id'), greatest(v_max, 1), v_max > 0);
  return v_max;
end;
$$;

revoke all on function public.sync_qr_id_sequence() from public;
grant execute on function public.sync_qr_id_sequence() to authenticated;
