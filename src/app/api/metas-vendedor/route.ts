import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get('mes') || ''

  const { data, error } = await supabase
    .from('metas_vendedor')
    .select('*')
    .eq('mes', mes)
    .order('vendedor')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const body = await request.json()
  const { vendedor, mes, meta, meta_leads } = body

  if (!vendedor || !mes || meta === undefined) {
    return NextResponse.json({ error: 'vendedor, mes e meta são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('metas_vendedor')
    .upsert({ vendedor, mes, meta, meta_leads: meta_leads ?? 0 }, { onConflict: 'vendedor,mes' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor') || ''
  const mes = searchParams.get('mes') || ''

  const { error } = await supabase
    .from('metas_vendedor')
    .delete()
    .eq('vendedor', vendedor)
    .eq('mes', mes)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
