-- ------------------------------------------------------------------
-- Gráfico de escaneos entre dos fechas elegidas a mano.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada, no cambia ningún dato, y no toca las funciones que ya
-- usa el gráfico: agrega una nueva al lado.
--
-- Mientras no lo corras, los botones Por día / Por semana / Por mes siguen
-- andando igual; solo el elegidor de fechas avisa que falta este paso.
-- ------------------------------------------------------------------

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
