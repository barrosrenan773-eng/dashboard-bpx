export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const mes = req.nextUrl.searchParams.get('mes')
  if (!mes) return NextResponse.json({ error: 'mes obrigatório' }, { status: 400 })
  const { data, error } = await supabase.from('previsao_folha').select('*').eq('mes', mes).single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { mes, valor: 0 })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const { mes, valor } = await req.json()
  if (!mes) return NextResponse.json({ error: 'mes obrigatório' }, { status: 400 })
  const { error } = await supabase
    .from('previsao_folha')
    .upsert({ mes, valor: valor ?? 0 }, { onConflict: 'mes' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
