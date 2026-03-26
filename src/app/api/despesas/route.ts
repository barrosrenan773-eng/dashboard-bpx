import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
)

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get('mes')

  let query = supabase
    .from('despesas')
    .select('*')
    .order('created_at', { ascending: false })

  if (mes) {
    query = query.eq('mes', mes)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { descricao, categoria, valor, mes } = body

  if (!descricao || !categoria || !mes) {
    return NextResponse.json({ error: 'descricao, categoria e mes obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('despesas')
    .insert({ descricao, categoria, valor: valor ?? 0, mes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('despesas')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('despesas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
