import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Create contratos table via Supabase SQL
  const queries = [
    `CREATE TABLE IF NOT EXISTS contratos (
      id BIGSERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      servico TEXT NOT NULL,
      capital NUMERIC NOT NULL DEFAULT 0,
      taxa NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'pendente', 'finalizado')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE contratos ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contratos' AND policyname = 'service_role_all_contratos') THEN
        CREATE POLICY "service_role_all_contratos" ON contratos FOR ALL USING (true);
      END IF;
    END $$`,
  ]

  const results = []
  for (const query of queries) {
    const { error } = await supabase.rpc('exec_sql', { sql: query }).catch(() => ({ error: null }))
    results.push({ query: query.slice(0, 50), error: error?.message ?? null })
  }

  // Try direct insert to verify table exists
  const { error: checkError } = await supabase.from('contratos').select('id').limit(1)

  return NextResponse.json({ results, tableExists: !checkError, checkError: checkError?.message })
}
