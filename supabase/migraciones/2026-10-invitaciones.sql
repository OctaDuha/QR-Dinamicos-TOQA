-- ------------------------------------------------------------------
-- Lista de invitados: sumar a alguien se hace en un solo lugar.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada y no cambia ningún QR ni ningún usuario existente.
--
-- Requiere haber corrido antes 2026-10-acceso-aprobado.sql.
--
-- Cómo queda:
--   - El dueño escribe un mail en la pantalla Usuarios del panel.
--   - Esa persona entra con Google y ya tiene acceso, con el rol elegido.
--   - Cualquier mail que no esté invitado es rechazado por la base antes de
--     que exista la cuenta: ni siquiera queda "pendiente".
--   - Las cuentas NUEVAS con contraseña se rechazan siempre: las cuentas
--     nuevas entran con Google. Las que ya existen siguen entrando como
--     siempre, con contraseña o con Google.
--
-- IMPORTANTE: recién después de correr esto se enciende en Supabase
-- "Allow new users to sign up". Esta base pasa a ser la que decide quién
-- se puede registrar; con el interruptor apagado, ni los invitados podrían.
-- ------------------------------------------------------------------

-- 1. La lista.
create table if not exists public.invitaciones (
  email        text primary key,
  rol          text not null default 'empleado',
  invitado_por uuid references auth.users (id) on delete set null,
  creado_en    timestamptz not null default now()
);

do $$
begin
  alter table public.invitaciones
    add constraint invitaciones_rol_check check (rol in ('dueno', 'empleado'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  -- Siempre en minusculas: Google y la gente no siempre escriben igual.
  alter table public.invitaciones
    add constraint invitaciones_email_minusculas check (email = lower(email));
exception
  when duplicate_object then null;
end;
$$;

alter table public.invitaciones enable row level security;

drop policy if exists invitaciones_dueno on public.invitaciones;
create policy invitaciones_dueno on public.invitaciones
  for all to authenticated using (public.es_dueno()) with check (public.es_dueno());

revoke all on public.invitaciones from anon;
grant select, insert, delete on public.invitaciones to authenticated;

-- 2. La puerta: antes de crear cualquier cuenta, ¿está invitada?
create or replace function public.solo_invitados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Una base nueva, sin dueño todavia: la primera cuenta pasa y queda de
  -- dueño. Si no, nadie podria invitar a nadie.
  if not exists (select 1 from public.perfiles where rol = 'dueno') then
    return new;
  end if;

  -- Cuentas nuevas con contraseña, nunca: alguien podria registrar con
  -- contraseña el mail de un invitado antes que el. Con Google, el mail lo
  -- confirma Google.
  if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email' then
    raise exception 'Las cuentas nuevas se crean entrando con Google';
  end if;

  if exists (select 1 from public.invitaciones where email = lower(new.email)) then
    return new;
  end if;

  raise exception 'Ese mail no esta invitado al panel';
end;
$$;

drop trigger if exists solo_invitados on auth.users;
create trigger solo_invitados
  before insert on auth.users
  for each row execute function public.solo_invitados();

-- 3. Al crearse la cuenta, toma el rol de su invitacion y la invitacion se
--    usa. Sin invitacion (no deberia pasar con la puerta de arriba) queda
--    sin acceso, como antes.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  if not exists (select 1 from public.perfiles where rol = 'dueno') then
    v_rol := 'dueno';
  else
    delete from public.invitaciones where email = lower(new.email) returning rol into v_rol;
    v_rol := coalesce(v_rol, 'pendiente');
  end if;

  insert into public.perfiles (id, email, rol)
  values (new.id, new.email, v_rol)
  on conflict (id) do nothing;
  return new;
end;
$$;
