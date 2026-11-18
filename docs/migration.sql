-- =============================================
--  DedSec — Supabase Database Migration
--  Run this in your Supabase SQL Editor
-- =============================================

-- Scans table
create table scans (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  repo_url text not null,
  status text not null default 'queued',
  security_score int,
  total_vulnerabilities int default 0,
  critical_count int default 0,
  high_count int default 0,
  medium_count int default 0,
  low_count int default 0,
  scanned_files int default 0,
  scan_duration_seconds float,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Vulnerabilities table
create table vulnerabilities (
  id uuid primary key,
  scan_id uuid references scans(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  severity text not null,
  file_path text not null,
  line_start int,
  line_end int,
  code_snippet text,
  recommendation text,
  cwe_id text,
  owasp_category text
);

-- Realtime progress table
create table scan_progress (
  scan_id uuid primary key references scans(id) on delete cascade,
  message text,
  progress_pct int default 0,
  partial_findings int default 0,
  updated_at timestamptz default now()
);

-- Row Level Security
-- O site so le, e so as proprias analises. Toda escrita passa pela API, que usa
-- a chave service_role (ignora estas politicas e nao e afetada pelos revokes).
alter table scans enable row level security;
alter table vulnerabilities enable row level security;
alter table scan_progress enable row level security;

create policy "Usuario le as proprias analises"
  on scans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuario le as proprias vulnerabilidades"
  on vulnerabilities for select to authenticated
  using (scan_id in (select id from scans where user_id = (select auth.uid())));

create policy "Usuario acompanha as proprias analises"
  on scan_progress for select to authenticated
  using (scan_id in (select id from scans where user_id = (select auth.uid())));

revoke all on table scans, vulnerabilities, scan_progress from anon;
revoke insert, update, delete, truncate, references, trigger
  on table scans, vulnerabilities, scan_progress from authenticated;

-- Enable Realtime (o progresso chega ao navegador; o RLS acima filtra por dono)
alter publication supabase_realtime add table scan_progress;

-- Avatares: bucket publico para leitura, so imagens de ate 2 MB.
-- O arquivo de cada usuario se chama "<id do usuario>.<extensao>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "Avatar: dono le" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy "Avatar: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy "Avatar: dono atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy "Avatar: dono remove" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
