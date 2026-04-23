/**
 * Migração: preenche o campo "empresa" nos detalhes do historico_conciliacoes
 * buscando o valor na tabela despesas via despesa_id.
 */
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://ffpeboanytasxoihrflz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcGVib2FueXRhc3hvaWhyZmx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc4OTgyNywiZXhwIjoyMDg5MzY1ODI3fQ.MKb-7z5MsgBsQq17JCPGyYjT6FiHppP_JnfXRQELmwI'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Busca todos os registros do histórico
  const { data: historico, error } = await sb
    .from('historico_conciliacoes')
    .select('id, detalhes')
  if (error) { console.error('Erro ao buscar histórico:', error.message); process.exit(1) }

  // Coleta todos os despesa_ids únicos que precisam de empresa
  const ids = []
  for (const h of historico) {
    for (const d of (h.detalhes ?? [])) {
      if (d.despesa_id && !d.empresa) ids.push(d.despesa_id)
    }
  }
  const uniqueIds = [...new Set(ids)]
  console.log(`Despesas a buscar: ${uniqueIds.length}`)

  if (uniqueIds.length === 0) {
    console.log('Nada a migrar.')
    return
  }

  // Busca as despesas em lote
  const { data: despesas, error: dErr } = await sb
    .from('despesas')
    .select('id, empresa')
    .in('id', uniqueIds)
  if (dErr) { console.error('Erro ao buscar despesas:', dErr.message); process.exit(1) }

  const empresaMap = {}
  for (const d of despesas) empresaMap[d.id] = d.empresa || 'BPX'
  console.log(`Empresas mapeadas: ${Object.keys(empresaMap).length}`)

  // Atualiza cada registro do histórico que tem detalhes sem empresa
  let atualizados = 0
  for (const h of historico) {
    const detalhes = h.detalhes ?? []
    let mudou = false
    const novosDetalhes = detalhes.map(d => {
      if (d.despesa_id && !d.empresa && empresaMap[d.despesa_id]) {
        mudou = true
        return { ...d, empresa: empresaMap[d.despesa_id] }
      }
      return d
    })
    if (!mudou) continue

    const { error: upErr } = await sb
      .from('historico_conciliacoes')
      .update({ detalhes: novosDetalhes })
      .eq('id', h.id)
    if (upErr) {
      console.error(`Erro ao atualizar ${h.id}:`, upErr.message)
    } else {
      atualizados++
      console.log(`Atualizado: ${h.id}`)
    }
  }

  console.log(`\nConcluído. ${atualizados} registros atualizados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
