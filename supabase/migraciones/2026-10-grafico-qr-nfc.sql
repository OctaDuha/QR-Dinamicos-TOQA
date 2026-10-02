-- ------------------------------------------------------------------
-- Gráfico de escaneos separado en QR y NFC.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada, no cambia ningún dato, y no toca la función que ya
-- usa el gráfico: agrega una nueva al lado.
--
-- Mientras no lo corras, el panel sigue mostrando el gráfico de siempre,
-- con el total. Apenas lo corrés, el gráfico pasa a mostrar QR y NFC por
-- separado, sin volver a desplegar nada.
-- ------------------------------------------------------------------

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
