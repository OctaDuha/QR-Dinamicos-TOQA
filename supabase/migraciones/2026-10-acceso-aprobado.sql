-- ------------------------------------------------------------------
-- Cuentas nuevas sin permisos hasta que el dueño las apruebe.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada y no cambia ningún QR. Los usuarios que ya existen
-- quedan con el rol que tienen (vos seguís de dueño).
--
-- Antes: cualquier cuenta que lograra entrar podía ver, crear y editar QRs.
-- Ahora: una cuenta nueva nace "pendiente" y no ve ni toca nada hasta que el
-- dueño la pasa a Empleado desde la pantalla Usuarios del panel.
--
-- Es la segunda cerradura. La primera es tener apagado "Allow new users to
-- sign up" en Supabase; esta sigue cerrando aunque aquel interruptor algún
-- día quedara encendido por error.
--
-- Requiere haber corrido antes 2026-09-roles.sql, 2026-10-grafico-qr-nfc.sql
-- y 2026-10-rango-fechas.sql.
-- ------------------------------------------------------------------

-- 1. "pendiente" pasa a ser un rol valido, y el de cualquier cuenta nueva.
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check check (rol in ('dueno', 'empleado', 'pendiente'));
alter table public.perfiles alter column rol set default 'pendiente';

-- 2. Cada usuario nuevo arranca pendiente. La unica excepcion es el primero
--    de todos, que queda de dueño: si no, una base nueva no tendria a nadie
--    que pudiera aprobar a nadie.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, rol)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.perfiles where rol = 'dueno') then 'pendiente' else 'dueno' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. La pregunta que usan las politicas: ¿esta cuenta fue aprobada?
create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles where id = auth.uid() and rol in ('dueno', 'empleado')
  );
$$;

revoke all on function public.es_miembro() from public;
grant execute on function public.es_miembro() to authenticated;

-- 4. Ver, crear y editar pasa a exigir una cuenta aprobada. Borrar sigue
--    siendo solo del dueño, como antes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'qr_codes', 'scans', 'canva_connections', 'canva_batches', 'canva_batch_items',
    'placa_designs'
  ] loop
    -- Por si alguna vez se volvio a correr schema.sql entero: su politica
    -- vieja lo permitia todo y, sumada a estas, las anularia.
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);

    execute format('drop policy if exists %I on public.%I', t || '_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_miembro())',
                   t || '_leer', t);

    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_miembro())',
                   t || '_crear', t);

    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())',
                   t || '_editar', t);

    execute format('drop policy if exists %I on public.%I', t || '_borrar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_dueno())',
                   t || '_borrar', t);
  end loop;
end;
$$;

-- 5. Las funciones del grafico leen con permisos propios (por eso andan sin
--    pasar por las politicas de arriba): reciben el mismo control. El resto
--    de cada funcion queda exactamente igual.
create or replace function public.qr_scan_series(
  p_qr_id  bigint,
  p_bucket text,
  p_from   timestamptz,
  p_tz     text default 'America/Argentina/Buenos_Aires'
)
returns table (bucket_start timestamp, scans bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
-- Los nombres de OUT (bucket_start, scans) chocan con la tabla scans y sus
-- columnas; que gane siempre la columna.
#variable_conflict use_column
begin
  -- Una cuenta pendiente de aprobacion no ve ni las estadisticas.
  if not public.es_miembro() then
    return;
  end if;

  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'bucket invalido: %', p_bucket;
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(p_bucket, p_from at time zone p_tz),
      date_trunc(p_bucket, now()   at time zone p_tz),
      ('1 ' || p_bucket)::interval
    ) as bucket_start
  )
  select b.bucket_start,
         count(s.id)::bigint
  from buckets b
  left join public.scans s
    on s.qr_id = p_qr_id
   and date_trunc(p_bucket, s.scanned_at at time zone p_tz) = b.bucket_start
  group by b.bucket_start
  order by b.bucket_start;
end;
$$;

revoke all on function public.qr_scan_series(bigint, text, timestamptz, text) from public;
grant execute on function public.qr_scan_series(bigint, text, timestamptz, text) to authenticated;

create or replace function public.qr_scan_series_via(
  p_qr_id  bigint,
  p_bucket text,
  p_from   timestamptz,
  p_tz     text default 'America/Argentina/Buenos_Aires'
)
returns table (bucket_start timestamp, qr bigint, nfc bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  -- Una cuenta pendiente de aprobacion no ve ni las estadisticas.
  if not public.es_miembro() then
    return;
  end if;

  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'bucket invalido: %', p_bucket;
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(p_bucket, p_from at time zone p_tz),
      date_trunc(p_bucket, now()   at time zone p_tz),
      ('1 ' || p_bucket)::interval
    ) as bucket_start
  )
  -- Todo lo que no es NFC es QR: los escaneos de antes de que existiera la
  -- columna quedaron marcados como 'qr', que es lo que eran.
  select b.bucket_start,
         (count(s.id) filter (where s.via is distinct from 'nfc'))::bigint,
         (count(s.id) filter (where s.via = 'nfc'))::bigint
  from buckets b
  left join public.scans s
    on s.qr_id = p_qr_id
   and date_trunc(p_bucket, s.scanned_at at time zone p_tz) = b.bucket_start
  group by b.bucket_start
  order by b.bucket_start;
end;
$$;

revoke all on function public.qr_scan_series_via(bigint, text, timestamptz, text) from public;
grant execute on function public.qr_scan_series_via(bigint, text, timestamptz, text) to authenticated;

create or replace function public.qr_scan_series_rango(
  p_qr_id  bigint,
  p_bucket text,
  p_desde  date,
  p_hasta  date,
  p_tz     text default 'America/Argentina/Buenos_Aires'
)
returns table (bucket_start timestamp, qr bigint, nfc bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  -- Una cuenta pendiente de aprobacion no ve ni las estadisticas.
  if not public.es_miembro() then
    return;
  end if;

  if p_bucket not in ('day', 'week', 'month', 'year') then
    raise exception 'bucket invalido: %', p_bucket;
  end if;
  if p_hasta < p_desde then
    raise exception 'la fecha hasta (%) es anterior a desde (%)', p_hasta, p_desde;
  end if;
  if p_hasta - p_desde > 36600 then
    raise exception 'rango demasiado largo';
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(p_bucket, p_desde::timestamp),
      date_trunc(p_bucket, p_hasta::timestamp),
      ('1 ' || p_bucket)::interval
    ) as bucket_start
  )
  -- Las fechas son dias de Argentina, de punta a punta: "hasta el 25" incluye
  -- todo el 25. Y un escaneo del 24 no entra aunque caiga en la misma
  -- semana o el mismo mes que el 25: el total tiene que ser el del rango.
  select b.bucket_start,
         (count(s.id) filter (where s.via is distinct from 'nfc'))::bigint,
         (count(s.id) filter (where s.via = 'nfc'))::bigint
  from buckets b
  left join public.scans s
    on s.qr_id = p_qr_id
   and (s.scanned_at at time zone p_tz) >= p_desde::timestamp
   and (s.scanned_at at time zone p_tz) <  (p_hasta + 1)::timestamp
   and date_trunc(p_bucket, s.scanned_at at time zone p_tz) = b.bucket_start
  group by b.bucket_start
  order by b.bucket_start;
end;
$$;

revoke all on function public.qr_scan_series_rango(bigint, text, date, date, text) from public;
grant execute on function public.qr_scan_series_rango(bigint, text, date, date, text) to authenticated;
