import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Lista todos os usuários
export async function GET() {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, role, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(profiles)
}

// Cria novo usuário e convida por email
export async function POST(request: Request) {
  const { email, name, role } = await request.json()

  // inviteUserByEmail envia o email de convite automaticamente
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: 'https://dashboard-sooty-psi.vercel.app/login',
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Cria/atualiza perfil
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: authData.user.id, email, name: name || email, role: role || 'visualizador' })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  return NextResponse.json({ success: true, id: authData.user.id })
}

// Atualiza role de usuário
export async function PATCH(request: Request) {
  const { id, role } = await request.json()

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Deleta usuário
export async function DELETE(request: Request) {
  const { id } = await request.json()

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
