-- ------------------------------------------------------------------
-- Roles de usuario: dueño y empleado.
--
-- Pegá TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una
-- vez. No borra nada y no cambia ningún dato de los QR.
--
-- Al correrlo, el usuario más antiguo (vos) queda como dueño y cualquier
-- otro como empleado.
--
--   dueño    → todo, incluido borrar QR, borrar diseños y asignar roles
--   empleado → crear, editar, imprimir, exportar. NO puede borrar nada.
--
-- El control no vive en la pantalla sino en la base: aunque alguien
-- intentara saltear la interfaz, Postgres le rechaza el borrado igual.
-- ------------------------------------------------------------------

-- 1. Quién es quién.
create table if not exists public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text,
  rol       text not null default 'empleado',
  creado_en timestamptz not null default now()
);

do $$
begin
  alter table public.perfiles add constraint perfiles_rol_check check (rol in ('dueno', 'empleado'));
exception
  when duplicate_object then null;
end;
$$;

-- 2. Cada usuario nuevo arranca como empleado, salvo que sea el primero.
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
    case when exists (select 1 from public.perfiles where rol = 'dueno') then 'empleado' else 'dueno' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- 3. Los usuarios que ya existían quedan con perfil, y el más antiguo dueño.
insert into public.perfiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;

update public.perfiles
set rol = 'dueno'
where id = (select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.perfiles where rol = 'dueno');

-- 4. La pregunta que usan las políticas.
create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'dueno');
$$;

revoke all on function public.es_dueno() from public;
grant execute on function public.es_dueno() to authenticated;

-- 5. Permisos sobre los perfiles: todos se ven, sólo el dueño reparte roles.
alter table public.perfiles enable row level security;

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles
  for select to authenticated using (true);

drop policy if exists perfiles_escribir on public.perfiles;
create policy perfiles_escribir on public.perfiles
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());

drop policy if exists perfiles_borrar on public.perfiles;
create policy perfiles_borrar on public.perfiles
  for delete to authenticated using (public.es_dueno());

revoke all on public.perfiles from anon;
grant select, update on public.perfiles to authenticated;

-- 6. Borrar queda reservado al dueño. Lo demás sigue igual para todos.
do $$
declare
  t text;
begin
  foreach t in array array[
    'qr_codes', 'scans', 'canva_connections', 'canva_batches', 'canva_batch_items',
    'placa_designs'
  ] loop
    -- La politica vieja permitia todo, borrado incluido: se reemplaza por
    -- una por operacion para poder tratar el borrado distinto.
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);

    execute format('drop policy if exists %I on public.%I', t || '_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)',
                   t || '_leer', t);

    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)',
                   t || '_crear', t);

    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)',
                   t || '_editar', t);

    execute format('drop policy if exists %I on public.%I', t || '_borrar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_dueno())',
                   t || '_borrar', t);
  end loop;
end;
$$;
