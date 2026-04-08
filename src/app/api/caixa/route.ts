import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  )
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const mes = req.nextUrl.searchParams.get('mes')

  let query = supabase
    .from('caixa')
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
  const supabase = getSupabase()
  const body = await req.json()
  const { tipo, caixa_tipo, descricao, valor, mes } = body

  if (!tipo || !mes) {
    return NextResponse.json({ error: 'tipo e mes obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('caixa')
    .insert({ tipo, caixa_tipo: caixa_tipo ?? 'bpx', descricao: descricao ?? '', valor: valor ?? 0, mes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('caixa')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('caixa').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
