-- ════════════════════════════════════════════════════════════════════════════
-- sessoes_supervisor — coluna `score` (nota global da sessão de Supervisor de Sonhos)
-- DreamSpace TI · Transpersonal International
--
-- Motivo: o desbloqueio da Anamnese passa a exigir sessões com score > 70 (antes era
-- só contagem de sessões concluídas). O score já era calculado no report e gravado em
-- mensagens.metadata.score; esta coluna materializa-o em sessoes_supervisor para o filtro.
--
-- Idempotente. Aplicar no SQL Editor do Supabase (ou via CLI). STAGING primeiro.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Coluna de score (0-100). NULL = sessão sem report/avaliação → não conta para o desbloqueio.
alter table public.sessoes_supervisor
  add column if not exists score integer;

-- 2) Backfill das sessões antigas (concluídas antes desta mudança):
--    lê o score do ÚLTIMO report do Supervisor (mensagens.metadata.score, type='supervisor_report').
--    Só preenche onde score IS NULL → seguro re-correr.
update public.sessoes_supervisor s
set score = sub.score
from (
  select distinct on (m.sessao_supervisor_id)
    m.sessao_supervisor_id as sid,
    nullif(m.metadata->>'score', '')::int as score
  from public.mensagens m
  where m.sessao_supervisor_id is not null
    and m.metadata->>'type' = 'supervisor_report'
    and m.metadata->>'score' is not null
  order by m.sessao_supervisor_id, m.ordem desc   -- report mais recente por sessão
) sub
where s.id = sub.sid
  and s.score is null;
