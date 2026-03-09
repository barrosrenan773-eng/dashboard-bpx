-- =============================================
-- DAMATTA DASHBOARD - Setup do banco de dados
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- 1. Tabela de usuários/perfis
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'visualizador' CHECK (role IN ('admin', 'gestor', 'vendedor', 'visualizador')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de metas mensais
CREATE TABLE IF NOT EXISTS public.metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canal TEXT NOT NULL,
  mes TEXT NOT NULL, -- formato: '2026-03'
  objetivo NUMERIC(15,2) DEFAULT 0,
  sessoes_meta INTEGER DEFAULT 0,
  conversao_ideal NUMERIC(5,2) DEFAULT 0,
  ticket_ideal NUMERIC(10,2) DEFAULT 0,
  roas_ideal NUMERIC(5,2) DEFAULT 0,
  cpl_ideal NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canal, mes)
);

-- 3. Tabela de dados sincronizados dos canais
CREATE TABLE IF NOT EXISTS public.canal_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canal TEXT NOT NULL,
  data DATE NOT NULL,
  receita NUMERIC(15,2) DEFAULT 0,
  vendas INTEGER DEFAULT 0,
  sessoes INTEGER DEFAULT 0,
  investimento NUMERIC(15,2) DEFAULT 0,
  lucro NUMERIC(15,2) DEFAULT 0,
  conversao NUMERIC(5,2) DEFAULT 0,
  ticket NUMERIC(10,2) DEFAULT 0,
  roas NUMERIC(5,2) DEFAULT 0,
  cac NUMERIC(10,2) DEFAULT 0,
  cpl NUMERIC(10,2) DEFAULT 0,
  leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canal, data)
);

-- 4. Tabela de dados dos vendedores (via CLINT CRM)
CREATE TABLE IF NOT EXISTS public.vendedor_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor TEXT NOT NULL,
  gestor TEXT,
  mes TEXT NOT NULL,
  valor_realizado NUMERIC(15,2) DEFAULT 0,
  valor_estimado NUMERIC(15,2) DEFAULT 0,
  vendas INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversao NUMERIC(5,2) DEFAULT 0,
  ticket NUMERIC(10,2) DEFAULT 0,
  cac NUMERIC(10,2) DEFAULT 0,
  roas NUMERIC(5,2) DEFAULT 0,
  cpl NUMERIC(10,2) DEFAULT 0,
  investimento NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendedor, mes)
);

-- 5. Tabela de log de sincronizações
CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados veem tudo
CREATE POLICY "Autenticados podem ver perfis" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Autenticados podem ver metas" ON public.metas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Autenticados podem ver canais" ON public.canal_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Autenticados podem ver vendedores" ON public.vendedor_data FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins podem tudo em metas" ON public.metas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- Trigger: criar perfil ao criar usuário
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, 'visualizador');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Dados iniciais de metas (março 2026)
-- =============================================
INSERT INTO public.metas (canal, mes, objetivo, sessoes_meta, conversao_ideal, ticket_ideal, roas_ideal) VALUES
  ('Barba Negra', '2026-03', 1943928.69, 268568, 2.57, 227.70, 2.51),
  ('Damatta Eros', '2026-03', 2022289.18, 311822, 3.02, 156.94, 2.20),
  ('Damatta Farma', '2026-03', 303654.16, 69554, 2.22, 143.17, 2.21),
  ('Amazon', '2026-03', 74036.55, 4511, 13.13, 94.28, 6.76),
  ('Shopee', '2026-03', 78874.42, 16771, 2.97, 135.83, 8.23),
  ('Email', '2026-03', 5259.76, 0, 0, 0, 0)
ON CONFLICT (canal, mes) DO NOTHING;
