CREATE TABLE IF NOT EXISTS despesas (
  id BIGSERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('fixa', 'variavel', 'pix', 'pessoal')),
  valor NUMERIC NOT NULL DEFAULT 0,
  mes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_despesas" ON despesas FOR ALL USING (true);
