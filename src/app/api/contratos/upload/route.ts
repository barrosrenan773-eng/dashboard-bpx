import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const id = formData.get('id') as string | null

  if (!file || !id) {
    return NextResponse.json({ error: 'file e id obrigatórios' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${id}/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('Contratos')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('Contratos').getPublicUrl(path)
  const url = urlData.publicUrl

  const { error: updateError } = await supabase
    .from('contratos')
    .update({ arquivo_url: url, arquivo_nome: file.name })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url, nome: file.name })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  // Remove arquivo_url e arquivo_nome do registro
  const { error } = await supabase
    .from('contratos')
    .update({ arquivo_url: null, arquivo_nome: null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
