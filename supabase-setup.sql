-- Rode no SQL Editor do Supabase (projeto novo).

-- 1) Bucket PRIVADO: cada cliente só enxerga a própria pasta ({client_id}/...).
insert into storage.buckets (id, name, public, file_size_limit)
values ('ar', 'ar', false, 52428800)
on conflict (id) do update set public = false;

-- 2) Cadastro de clientes (gerenciado só pelo admin / Edge Function).
create table if not exists public.clients (
  id uuid primary key,
  name text not null,
  login text not null unique,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.clients enable row level security;

create policy "clients admin" on public.clients
  for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- 3) Storage: admin faz tudo; cliente só LÊ a própria pasta.
create policy "ar admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'ar' and (auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check (bucket_id = 'ar' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "ar cliente leitura" on storage.objects
  for select to authenticated
  using (bucket_id = 'ar'
         and (storage.foldername(name))[1] = (auth.jwt()->'app_metadata'->>'client_id'));

-- 4) Depois de criar SEU usuário admin em Authentication > Users, marque-o como admin:
-- update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
--   where email = 'seu-email@exemplo.com';
