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

  let query = supabase
    .from('historico_conciliacoes')
    .select('*')
    .order('created_at', { ascending: false })

  if (mes) {
    query = query.eq('mes_referencia', mes)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { mes_referencia, qtd_transacoes, valor_total, detalhes } = body
  const { data, error } = await supabase
    .from('historico_conciliacoes')
    .insert({ mes_referencia, qtd_transacoes, valor_total, detalhes })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  const { id, fitid, descricao } = await req.json()
  if (!id || !fitid) return NextResponse.json({ error: 'id e fitid obrigatórios' }, { status: 400 })

  const { data: row, error: fetchErr } = await supabase
    .from('historico_conciliacoes').select('detalhes').eq('id', id).single()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const detalhes = (row?.detalhes ?? []).map((d: any) =>
    d.fitid === fitid ? { ...d, descricao } : d
  )
  const { error } = await supabase
    .from('historico_conciliacoes').update({ detalhes }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('historico_conciliacoes')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
