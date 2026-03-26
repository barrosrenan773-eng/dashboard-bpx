export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const mes = req.nextUrl.searchParams.get('mes')
  if (!mes) return NextResponse.json({ error: 'mes obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('metas_vendedor')
    .select('*')
    .eq('mes', mes)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { vendedor, mes, meta, meta_leads, meta_conversao, meta_ticket } = body

  if (!vendedor || !mes) return NextResponse.json({ error: 'vendedor e mes obrigatórios' }, { status: 400 })

  const { error } = await supabase
    .from('metas_vendedor')
    .upsert({ vendedor, mes, meta, meta_leads, meta_conversao, meta_ticket }, { onConflict: 'vendedor,mes' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const vendedor = req.nextUrl.searchParams.get('vendedor')
  const mes = req.nextUrl.searchParams.get('mes')

  if (!vendedor || !mes) return NextResponse.json({ error: 'vendedor e mes obrigatórios' }, { status: 400 })

  const { error } = await supabase
    .from('metas_vendedor')
    .delete()
    .eq('vendedor', vendedor)
    .eq('mes', mes)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
