import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get('mes') || ''

  const { data } = await supabase
    .from('precificacao_config')
    .select('*')
    .eq('mes', mes)
    .single()

  if (!data) {
    return NextResponse.json({
      mes,
      imposto_pct: 9.18,
      comissao_pct: 7.0,
      taxa_financeira_pct: 1.07,
      custos_fixos: [],
    })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { mes, imposto_pct, comissao_pct, taxa_financeira_pct, custos_fixos } = body

  const { error } = await supabase
    .from('precificacao_config')
    .upsert({
      mes,
      imposto_pct,
      comissao_pct,
      taxa_financeira_pct,
      custos_fixos,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mes' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
