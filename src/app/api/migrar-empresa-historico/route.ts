import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return createClient(url, key)
}

export async function GET() {
  const sb = getSupabase()

  const { data: historico, error } = await sb
    .from('historico_conciliacoes')
    .select('id, detalhes')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids: number[] = []
  for (const h of historico ?? []) {
    for (const d of (h.detalhes ?? [])) {
      if (d.despesa_id && !d.empresa) ids.push(d.despesa_id)
    }
  }
  const uniqueIds = [...new Set(ids)]

  if (uniqueIds.length === 0) return NextResponse.json({ ok: true, atualizados: 0, msg: 'Nada a migrar' })

  const { data: despesas, error: dErr } = await sb
    .from('despesas')
    .select('id, empresa')
    .in('id', uniqueIds)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  const empresaMap: Record<number, string> = {}
  for (const d of despesas ?? []) empresaMap[d.id] = d.empresa || 'BPX'

  let atualizados = 0
  for (const h of historico ?? []) {
    const detalhes = h.detalhes ?? []
    let mudou = false
    const novos = detalhes.map((d: any) => {
      if (d.despesa_id && !d.empresa && empresaMap[d.despesa_id]) {
        mudou = true
        return { ...d, empresa: empresaMap[d.despesa_id] }
      }
      return d
    })
    if (!mudou) continue
    const { error: upErr } = await sb
      .from('historico_conciliacoes')
      .update({ detalhes: novos })
      .eq('id', h.id)
    if (!upErr) atualizados++
  }

  return NextResponse.json({ ok: true, atualizados, despesasMapeadas: uniqueIds.length })
}
