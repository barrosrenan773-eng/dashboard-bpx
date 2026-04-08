-- =============================================
-- LOCALIZADOR DE SERVIDORES — Setup Supabase
-- Execute este SQL no Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.localizador_servidores (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  orgao                TEXT NOT NULL,
  nome                 TEXT NOT NULL,
  cpf                  TEXT NOT NULL,
  cidade               TEXT,
  estado               TEXT DEFAULT 'AP',
  tel_principal        TEXT,
  tel_secundario       TEXT,
  tel_operadora_1      TEXT,
  tel_operadora_2      TEXT,
  margem_disponivel    TEXT,
  consignacoes_ativas  INTEGER DEFAULT 0,
  status_consulta      TEXT DEFAULT 'ok' CHECK (status_consulta IN ('ok', 'nao_encontrado', 'erro')),
  consultado_em        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cpf)
);

-- RLS
ALTER TABLE public.localizador_servidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver localizador"
  ON public.localizador_servidores FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem inserir localizador"
  ON public.localizador_servidores FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem atualizar localizador"
  ON public.localizador_servidores FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_localizador_orgao ON public.localizador_servidores(orgao);
CREATE INDEX IF NOT EXISTS idx_localizador_cpf   ON public.localizador_servidores(cpf);
