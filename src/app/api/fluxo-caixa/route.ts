export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const mes = req.nextUrl.searchParams.get('mes')
  if (!mes) return NextResponse.json({ error: 'mes obrigatório' }, { status: 400 })

  const inicio = `${mes}-01`
  const [y, m] = mes.split('-').map(Number)
  const fim = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('fluxo_caixa_saldos')
    .select('*')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { data, saldo_real, saldo_inicial, observacao } = body

  if (!data) return NextResponse.json({ error: 'data obrigatória' }, { status: 400 })

  const { data: result, error } = await supabase
    .from('fluxo_caixa_saldos')
    .upsert({ data, saldo_real, saldo_inicial, observacao }, { onConflict: 'data' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
}
