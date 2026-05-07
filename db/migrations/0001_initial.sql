-- ============================================================
-- DreamSpace TI — Migration 0001_initial
-- ============================================================

-- Extensões
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type plataforma_nivel as enum ('base', 'avancado', 'profissional');
create type sessao_estado as enum ('em_curso', 'concluida', 'arquivada');
create type metodo_terapeutico as enum (
  'freud_associacao_livre',
  'jung_amplificacao',
  'hillman_imagem',
  'delaney_dream_interview',
  'gendlin_focusing',
  'bosnak_embodied',
  'perls_gestalt',
  'hill_cognitivo_experiencial',
  'ullman_grupo',
  'taylor_grupo',
  'lucido',
  'integrado',
  'nao_definido'
);

-- ============================================================
-- profiles — perfil do formando
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome_completo text not null,
  modulos_acesso int[] not null default '{1}',
  nivel plataforma_nivel not null default 'base',
  data_inscricao timestamptz not null default now(),
  ultima_actividade timestamptz default now(),
  configuracoes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_email on public.profiles(email);

-- ============================================================
-- sonhos_diario
-- ============================================================
create table public.sonhos_diario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  data_sonho date not null,
  titulo text,
  texto text not null,
  emocao_score int check (emocao_score between 1 and 10),
  notas text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sonhos_user on public.sonhos_diario(user_id, data_sonho desc);

-- ============================================================
-- sessoes_supervisor
-- ============================================================
create table public.sessoes_supervisor (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sonho_id uuid references public.sonhos_diario(id) on delete set null,
  sonho_texto text not null,
  caso_descricao text,
  metodo_escolhido metodo_terapeutico default 'nao_definido',
  estado sessao_estado not null default 'em_curso',
  flags_detectados text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessoes_sup_user on public.sessoes_supervisor(user_id, created_at desc);

-- ============================================================
-- sessoes_avatar
-- ============================================================
create table public.sessoes_avatar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  avatar_slug text not null,
  nivel int not null default 1,
  estado sessao_estado not null default 'em_curso',
  ficheiro_revelado boolean not null default false,
  notas_evolucao jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessoes_avt_user on public.sessoes_avatar(user_id, created_at desc);

-- ============================================================
-- mensagens
-- ============================================================
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  sessao_supervisor_id uuid references public.sessoes_supervisor(id) on delete cascade,
  sessao_avatar_id uuid references public.sessoes_avatar(id) on delete cascade,
  papel text not null check (papel in ('user', 'assistant', 'system')),
  conteudo text not null,
  metadata jsonb default '{}'::jsonb,
  ordem int not null,
  created_at timestamptz not null default now(),

  constraint mensagem_uma_sessao check (
    (sessao_supervisor_id is not null and sessao_avatar_id is null) or
    (sessao_supervisor_id is null and sessao_avatar_id is not null)
  )
);

create index idx_msg_sup on public.mensagens(sessao_supervisor_id, ordem);
create index idx_msg_avt on public.mensagens(sessao_avatar_id, ordem);

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger sonhos_updated before update on public.sonhos_diario
  for each row execute function public.tg_set_updated_at();
create trigger sup_updated before update on public.sessoes_supervisor
  for each row execute function public.tg_set_updated_at();
create trigger avt_updated before update on public.sessoes_avatar
  for each row execute function public.tg_set_updated_at();

-- ============================================================
-- TRIGGER — criar profile automaticamente no signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome_completo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome_completo', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sonhos_diario enable row level security;
alter table public.sessoes_supervisor enable row level security;
alter table public.sessoes_avatar enable row level security;
alter table public.mensagens enable row level security;

create policy "profile_self_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profile_self_update" on public.profiles
  for update using (auth.uid() = id);

create policy "sonho_owner_all" on public.sonhos_diario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sup_owner_all" on public.sessoes_supervisor
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "avt_owner_all" on public.sessoes_avatar
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "msg_sup_owner" on public.mensagens
  for all using (
    sessao_supervisor_id in (select id from public.sessoes_supervisor where user_id = auth.uid())
    or
    sessao_avatar_id in (select id from public.sessoes_avatar where user_id = auth.uid())
  );
