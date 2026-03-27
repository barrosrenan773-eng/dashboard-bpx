import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { avancarParcelas } from '@/lib/parcelas'
import { randomUUID } from 'crypto'

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
)

export async function GET(req: NextRequest) {
  const status    = req.nextUrl.searchParams.get('status')
  const categoria = req.nextUrl.searchParams.get('categoria')
  const inicio    = req.nextUrl.searchParams.get('inicio')
  const fim       = req.nextUrl.searchParams.get('fim')

  // Auto-atualiza status vencido (vencimento passado e não pago)
  const hoje = new Date().toISOString().slice(0, 10)
  await supabase
    .from('contas_pagar')
    .update({ status: 'vencido' })
    .lt('data_vencimento', hoje)
    .eq('status', 'a_vencer')

  // Avança parcelas automáticas (lazy: garante funcionamento mesmo se o cron falhar)
  await avancarParcelas()

  let query = supabase
    .from('contas_pagar')
    .select('*')
    .order('data_vencimento', { ascending: true })

  if (status)    query = query.eq('status', status)
  if (categoria) query = query.eq('categoria', categoria)
  if (inicio)    query = query.gte('data_vencimento', inicio)
  if (fim)       query = query.lte('data_vencimento', fim)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { descricao, fornecedor, categoria, valor, data_vencimento, parcela_atual, total_parcelas, tipo } = body

  if (!descricao || !valor || !data_vencimento) {
    return NextResponse.json({ error: 'descricao, valor e data_vencimento obrigatórios' }, { status: 400 })
  }

  const hoje  = new Date().toISOString().slice(0, 10)
  const status = data_vencimento < hoje ? 'vencido' : 'a_vencer'

  // Conta parcelada: gera UUID para vincular todas as parcelas do mesmo grupo
  const parcelamento_id = tipo === 'parcelada' ? randomUUID() : null

  const { data, error } = await supabase
    .from('contas_pagar')
    .insert({
      descricao,
      fornecedor: fornecedor || '',
      categoria: categoria || 'outros',
      valor,
      data_vencimento,
      status,
      parcela_atual: parcela_atual ?? null,
      total_parcelas: total_parcelas ?? null,
      parcelamento_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, pagar, ...fields } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const updates = pagar
    ? { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) }
    : fields

  const { data, error } = await supabase
    .from('contas_pagar')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('contas_pagar').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
