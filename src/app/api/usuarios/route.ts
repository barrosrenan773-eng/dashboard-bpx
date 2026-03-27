import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — lista usuários com dados de auth + profiles
export async function GET() {
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const authMap: Record<string, { last_sign_in_at?: string; email?: string }> = {}
  authData?.users?.forEach(u => { authMap[u.id] = { last_sign_in_at: u.last_sign_in_at, email: u.email } })

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, role, ativo, abas_permitidas, escopo, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const merged = (profiles || []).map(p => ({
    ...p,
    email: p.email || authMap[p.id]?.email || '',
    ultimo_acesso: authMap[p.id]?.last_sign_in_at || null,
  }))

  return NextResponse.json(merged)
}

// POST — cria usuário com senha
export async function POST(req: Request) {
  const { email, name, password, role, abas_permitidas, escopo } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 })

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || email },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const defaultAbas = ['geral', 'consultores', 'financeiro', 'contratos', 'caixa', 'relatorios', 'fechamento']

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    email,
    name: name || email,
    role: role || 'visualizador',
    ativo: true,
    abas_permitidas: abas_permitidas ?? defaultAbas,
    escopo: escopo || 'geral',
  })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  return NextResponse.json({ success: true, id: authData.user.id })
}

// PUT — atualiza nome, role, ativo, abas, escopo ou senha
export async function PUT(req: Request) {
  const { id, name, role, ativo, abas_permitidas, escopo, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })

  if (password) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (name !== undefined)            update.name = name
  if (role !== undefined)            update.role = role
  if (ativo !== undefined)           update.ativo = ativo
  if (abas_permitidas !== undefined) update.abas_permitidas = abas_permitidas
  if (escopo !== undefined)          update.escopo = escopo

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from('profiles').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE — remove usuário do auth e do profiles
export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabaseAdmin.from('profiles').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
