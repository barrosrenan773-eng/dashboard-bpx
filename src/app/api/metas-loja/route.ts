import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const LOJAS_KEYS = ['eros', 'barba-negra', 'farma']

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
    .in('vendedor', LOJAS_KEYS)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const body = await request.json()
  const { loja, mes, meta, meta_conversao, meta_usuarios } = body

  if (!loja || !mes || meta === undefined) {
    return NextResponse.json({ error: 'loja, mes e meta são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('metas_vendedor')
    .upsert({
      vendedor: loja,
      mes,
      meta,
      meta_leads: 0,
      ...(meta_conversao !== undefined && { meta_conversao }),
      ...(meta_usuarios !== undefined && { meta_usuarios }),
    }, { onConflict: 'vendedor,mes' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
