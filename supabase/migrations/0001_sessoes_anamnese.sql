-- ════════════════════════════════════════════════════════════════════════════
-- Supervisor de Anamnese — tabela de sessões
-- DreamSpace TI · Transpersonal International
--
-- Idempotente. Aplicar no SQL Editor do Supabase (ou via CLI).
-- As narrativas dos 5 avatares são dados estáticos em código
-- (lib/anamnese/narrativas.ts) — NÃO precisam de tabela.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.sessoes_anamnese (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  avatar_id text not null,                              -- 'mariana' | 'ricardo' | 'sofia' | 'tiago' | 'carolina'
  historico_conversa jsonb not null default '[]'::jsonb,        -- TurnoConversa[]
  intervencoes_supervisor jsonb not null default '[]'::jsonb,   -- auxiliar / legado
  score_final integer,                                 -- 0-100
  relatorio jsonb,                                     -- RelatorioAnamnese
  estado text not null default 'em_curso',             -- 'em_curso' | 'concluida'
  modo text not null default 'escrito',                -- 'escrito' | 'voz'
  duracao_minutos integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sessoes_anamnese_user
  on public.sessoes_anamnese (user_id, created_at desc);

-- ── Row Level Security ─────────────────────────────────────────────────────────
alter table public.sessoes_anamnese enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sessoes_anamnese'
      and policyname = 'anamnese_select_own'
  ) then
    create policy anamnese_select_own on public.sessoes_anamnese
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sessoes_anamnese'
      and policyname = 'anamnese_insert_own'
  ) then
    create policy anamnese_insert_own on public.sessoes_anamnese
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sessoes_anamnese'
      and policyname = 'anamnese_update_own'
  ) then
    create policy anamnese_update_own on public.sessoes_anamnese
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sessoes_anamnese'
      and policyname = 'anamnese_delete_own'
  ) then
    create policy anamnese_delete_own on public.sessoes_anamnese
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── updated_at automático ────────────────────────────────────────────────────
create or replace function public.touch_sessoes_anamnese_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sessoes_anamnese_updated_at on public.sessoes_anamnese;
create trigger trg_sessoes_anamnese_updated_at
  before update on public.sessoes_anamnese
  for each row execute function public.touch_sessoes_anamnese_updated_at();
