-- =============================================================================
--  DedSec — correcao de seguranca do banco (002)
--
--  Para bancos criados com a versao anterior do migration.sql.
--  Rode uma vez no SQL Editor do Supabase. Rodar de novo nao causa problema.
--
--  O que muda:
--  1. scan_progress estava sem RLS e publicada no Realtime: com a chave publica,
--     que vai no JavaScript do site, qualquer pessoa podia ler, alterar e apagar
--     o progresso das analises de todos os usuarios.
--  2. As politicas de scans e vulnerabilities eram "for all": cada usuario
--     podia gravar nas proprias linhas direto pelo navegador (por exemplo,
--     forjar um relatorio com nota 100). O site so precisa ler; toda escrita
--     passa pela API, que usa a chave service_role.
--  3. O bucket de avatares passa a aceitar so imagens de ate 2 MB, e cada
--     usuario so mexe no proprio arquivo.
-- =============================================================================

-- ── 1. RLS em todas as tabelas ───────────────────────────────────────────────
alter table public.scans          enable row level security;
alter table public.vulnerabilities enable row level security;
alter table public.scan_progress  enable row level security;

-- ── 2. Politicas: somente leitura, somente das proprias analises ─────────────
drop policy if exists "Users see own scans"                      on public.scans;
drop policy if exists "Users see own vulnerabilities"            on public.vulnerabilities;
drop policy if exists "Usuario le as proprias analises"          on public.scans;
drop policy if exists "Usuario le as proprias vulnerabilidades"  on public.vulnerabilities;
drop policy if exists "Usuario acompanha as proprias analises"   on public.scan_progress;

create policy "Usuario le as proprias analises"
  on public.scans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuario le as proprias vulnerabilidades"
  on public.vulnerabilities for select to authenticated
  using (scan_id in (select id from public.scans where user_id = (select auth.uid())));

create policy "Usuario acompanha as proprias analises"
  on public.scan_progress for select to authenticated
  using (scan_id in (select id from public.scans where user_id = (select auth.uid())));

-- Defesa extra: sem permissao de escrita, nenhuma politica criada por engano
-- no futuro consegue reabrir a gravacao pelo navegador. A service_role (API e
-- processo trabalhador) nao e afetada.
revoke all on table public.scans, public.vulnerabilities, public.scan_progress from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.scans, public.vulnerabilities, public.scan_progress from authenticated;

-- ── 3. Avatares ──────────────────────────────────────────────────────────────
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
       file_size_limit    = 2097152
 where id = 'avatars';

-- O arquivo de cada usuario se chama "<id do usuario>.<extensao>".
drop policy if exists "Avatar: dono le"      on storage.objects;
drop policy if exists "Avatar: dono envia"   on storage.objects;
drop policy if exists "Avatar: dono atualiza" on storage.objects;
drop policy if exists "Avatar: dono remove"  on storage.objects;

create policy "Avatar: dono le" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy "Avatar: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy "Avatar: dono atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);
create policy "Avatar: dono remove" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

-- ── Conferencia ──────────────────────────────────────────────────────────────
-- As tres tabelas devem aparecer com rowsecurity = true:
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' and tablename in ('scans', 'vulnerabilities', 'scan_progress');

-- Todas as politicas. Politicas antigas com outros nomes continuam valendo e,
-- se forem amplas, anulam as de cima: confira se sobrou alguma alem das criadas aqui.
select schemaname, tablename, policyname, cmd, roles
  from pg_policies
 where schemaname in ('public', 'storage')
 order by schemaname, tablename, policyname;
