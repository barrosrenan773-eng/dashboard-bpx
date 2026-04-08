import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const sql = `
    CREATE TABLE IF NOT EXISTS contas_pagar (
      id BIGSERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      fornecedor TEXT NOT NULL DEFAULT '',
      categoria TEXT NOT NULL DEFAULT 'outros',
      valor NUMERIC NOT NULL DEFAULT 0,
      data_vencimento DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'a_vencer' CHECK (status IN ('a_vencer', 'vencido', 'pago')),
      data_pagamento DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contas_pagar' AND policyname = 'service_role_all_contas_pagar') THEN
        CREATE POLICY "service_role_all_contas_pagar" ON contas_pagar FOR ALL USING (true);
      END IF;
    END $$;
  `
  const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }))
  const { error: checkError } = await supabase.from('contas_pagar').select('id').limit(1)
  return NextResponse.json({ ok: !checkError, setupError: error, checkError: checkError?.message })
}
