import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
)

async function ensureTable() {
  await supabase.rpc('exec', { sql: '' }).catch(() => {})
  // Create table via raw postgres if not exists
  const { error } = await supabase.from('contratos').select('id').limit(1)
  if (error?.code === '42P01') {
    // Table doesn't exist — need manual creation
    return false
  }
  return true
}

export async function GET() {
  const { data, error } = await supabase
    .from('contratos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { nome, servico, capital, taxa, status } = body

  if (!nome || !servico) {
    return NextResponse.json({ error: 'nome e servico obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contratos')
    .insert({ nome, servico, capital: capital ?? 0, taxa: taxa ?? 0, status: status ?? 'aguardando' })
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
    .from('contratos')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('contratos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
