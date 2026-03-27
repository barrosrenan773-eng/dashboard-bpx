-- ============================================================
-- FECHAMENTO MENSAL BPX
-- Execute no SQL Editor do Supabase (projeto ffpeboanytasxoihrflz)
-- ============================================================

-- Tabela principal de fechamentos mensais (snapshot imutável)
CREATE TABLE IF NOT EXISTS monthly_closures (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia      text NOT NULL UNIQUE,         -- 'YYYY-MM'
  data_fechamento     timestamptz,
  status              text NOT NULL DEFAULT 'open'  CHECK (status IN ('open','closed')),

  -- Financeiro
  receita_total       numeric(15,2) NOT NULL DEFAULT 0,
  despesas_totais     numeric(15,2) NOT NULL DEFAULT 0,
  lucro_liquido       numeric(15,2) NOT NULL DEFAULT 0,
  margem              numeric(6,2)  NOT NULL DEFAULT 0,

  -- Contratos
  contratos_total     int NOT NULL DEFAULT 0,
  contratos_finalizados int NOT NULL DEFAULT 0,
  contratos_pendentes int NOT NULL DEFAULT 0,

  -- Capital
  capital_total       numeric(15,2) NOT NULL DEFAULT 0,
  capital_disponivel  numeric(15,2) NOT NULL DEFAULT 0,
  capital_em_operacao numeric(15,2) NOT NULL DEFAULT 0,
  capital_travado     numeric(15,2) NOT NULL DEFAULT 0,

  -- JSON payloads
  distribuicao_lucro  jsonb NOT NULL DEFAULT '[]',
  snapshot_completo   jsonb NOT NULL DEFAULT '{}',

  criado_em           timestamptz NOT NULL DEFAULT now(),
  fechado_por         uuid REFERENCES auth.users(id)
);

-- Tabela de transporte de pendências entre meses
CREATE TABLE IF NOT EXISTS monthly_carryover (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_origem      text NOT NULL,   -- 'YYYY-MM'
  mes_destino     text NOT NULL,   -- 'YYYY-MM'
  tipo            text NOT NULL,   -- 'contrato_pendente' | 'capital_fora' | 'valor_nao_liquidado' | 'capital_judicializado'
  referencia_id   uuid,            -- id do contrato/item de origem
  valor           numeric(15,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','resolvido','cancelado')),
  descricao       text,
  observacao      text,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_monthly_closures_mes   ON monthly_closures(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_monthly_closures_status ON monthly_closures(status);
CREATE INDEX IF NOT EXISTS idx_carryover_mes_destino   ON monthly_carryover(mes_destino);
CREATE INDEX IF NOT EXISTS idx_carryover_mes_origem    ON monthly_carryover(mes_origem);

-- Seed: garantir que o mês atual exista como "open"
INSERT INTO monthly_closures (mes_referencia, status)
VALUES (to_char(now(), 'YYYY-MM'), 'open')
ON CONFLICT (mes_referencia) DO NOTHING;

-- RLS: habilitar (ajuste políticas conforme necessário)
ALTER TABLE monthly_closures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_carryover ENABLE ROW LEVEL SECURITY;

-- Política de leitura para usuários autenticados
CREATE POLICY "Leitura autenticada" ON monthly_closures
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Leitura autenticada" ON monthly_carryover
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role pode tudo (usado pelo backend)
CREATE POLICY "Service role full access closures" ON monthly_closures
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access carryover" ON monthly_carryover
  USING (true) WITH CHECK (true);
