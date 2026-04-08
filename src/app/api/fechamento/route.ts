/**
 * API de Fechamento Mensal — BPX
 * Usa Supabase Storage para persistir snapshots (não depende do PostgREST/schema cache)
 * Bucket: "fechamentos" (criado automaticamente na primeira chamada)
 * Estrutura: fechamentos/closures/YYYY-MM.json
 *            fechamentos/carryover/YYYY-MM.json  (array de pendências)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).trim()
const SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const BUCKET       = 'fechamentos'

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Storage helpers ─────────────────────────────────────────────────────────

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
  }
}

async function readJSON<T>(path: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) return null
  const text = await data.text()
  try { return JSON.parse(text) as T } catch { return null }
}

async function writeJSON(path: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  await supabaseAdmin.storage.from(BUCKET).upload(path, blob, { upsert: true })
}

async function listFiles(prefix: string): Promise<string[]> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 200 })
  return (data || []).map(f => f.name).filter(n => n.endsWith('.json'))
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Closure {
  id: string
  mes_referencia: string
  data_fechamento: string | null
  status: 'open' | 'closed'
  receita_total: number
  despesas_totais: number
  lucro_liquido: number
  margem: number
  contratos_total: number
  contratos_finalizados: number
  contratos_pendentes: number
  capital_total: number
  capital_disponivel: number
  capital_em_operacao: number
  capital_travado: number
  distribuicao_lucro: unknown[]
  snapshot_completo: unknown
  criado_em: string
  fechado_por?: string | null
}

interface CarryoverItem {
  id: string
  mes_origem: string
  mes_destino: string
  tipo: string
  referencia_id: string | null
  valor: number
  descricao: string
  status: 'pendente' | 'resolvido' | 'cancelado'
  criado_em: string
}

// ─── GET: lista todos os fechamentos ─────────────────────────────────────────

export async function GET() {
  const mesAtual = new Date().toISOString().slice(0, 7)
  await ensureBucket()

  // Carregar todos os closures
  const closureFiles = await listFiles('closures')
  const closures: Closure[] = []
  for (const file of closureFiles) {
    const c = await readJSON<Closure>(`closures/${file}`)
    if (c) closures.push(c)
  }

  // Garantir que o mês atual existe como 'open'
  if (!closures.find(c => c.mes_referencia === mesAtual)) {
    const novoClosure: Closure = {
      id: crypto.randomUUID(),
      mes_referencia: mesAtual,
      data_fechamento: null,
      status: 'open',
      receita_total: 0, despesas_totais: 0, lucro_liquido: 0, margem: 0,
      contratos_total: 0, contratos_finalizados: 0, contratos_pendentes: 0,
      capital_total: 0, capital_disponivel: 0, capital_em_operacao: 0, capital_travado: 0,
      distribuicao_lucro: [], snapshot_completo: {},
      criado_em: new Date().toISOString(),
    }
    await writeJSON(`closures/${mesAtual}.json`, novoClosure)
    closures.push(novoClosure)
  }

  // Carregar carryover do mês atual
  const carryoverFiles = await listFiles('carryover')
  const carryover: CarryoverItem[] = []
  for (const file of carryoverFiles) {
    const items = await readJSON<CarryoverItem[]>(`carryover/${file}`)
    if (items) carryover.push(...items)
  }

  closures.sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))

  return NextResponse.json({ closures, carryover, mesAtual })
}

// ─── POST: executar fechamento ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { mes_referencia, fechado_por } = await req.json()
  if (!mes_referencia) return NextResponse.json({ error: 'mes_referencia obrigatório' }, { status: 400 })

  await ensureBucket()

  const existing = await readJSON<Closure>(`closures/${mes_referencia}.json`)
  if (existing?.status === 'closed') {
    return NextResponse.json({ error: 'Mês já fechado. Snapshot imutável.' }, { status: 400 })
  }

  // ── Consolidar dados do mês ──────────────────────────────────────────────────
  const mesInicio = `${mes_referencia}-01`
  const [ano, mesNum] = mes_referencia.split('-').map(Number)
  const proximoMes  = new Date(ano, mesNum, 1)
  const mesFim      = proximoMes.toISOString()

  const { data: contratos } = await supabaseAdmin
    .from('contratos').select('*').gte('created_at', mesInicio).lt('created_at', mesFim)

  const contratosLista      = contratos || []
  const contratosTotal      = contratosLista.length
  const contratosFinalizados = contratosLista.filter(c => c.status === 'finalizado').length
  const contratosPendentes  = contratosLista.filter(c => c.status !== 'finalizado').length
  const receitaTotal        = contratosLista.reduce((s, c) => s + (Number(c.taxa)    || 0), 0)
  const capitalTotal        = contratosLista.reduce((s, c) => s + (Number(c.capital) || 0), 0)

  const { data: despesas } = await supabaseAdmin.from('despesas').select('*').eq('mes', mes_referencia)
  const despesasTotal  = (despesas || []).reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const lucroLiquido   = receitaTotal - despesasTotal
  const margem         = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

  const capitalEmOperacao = contratosLista
    .filter(c => c.status === 'ativo')
    .reduce((s, c) => s + (Number(c.capital) || 0), 0)
  const capitalTravado = contratosLista
    .filter(c => ['judicializado', 'aguardando_liquidacao'].includes(c.status))
    .reduce((s, c) => s + (Number(c.capital) || 0), 0)
  const capitalDisponivel = capitalTotal - capitalEmOperacao - capitalTravado

  const distribuicaoLucro = [
    { nome: 'Francisco', percentual: 45.5, valor: lucroLiquido * 0.455 },
    { nome: 'Renan',     percentual: 45.5, valor: lucroLiquido * 0.455 },
    { nome: 'Felipe',    percentual: 5,    valor: lucroLiquido * 0.05  },
    { nome: 'Marcelo',   percentual: 4,    valor: lucroLiquido * 0.04  },
  ]

  const closure: Closure = {
    id: existing?.id || crypto.randomUUID(),
    mes_referencia,
    data_fechamento: new Date().toISOString(),
    status: 'closed',
    receita_total: receitaTotal,
    despesas_totais: despesasTotal,
    lucro_liquido: lucroLiquido,
    margem: Math.round(margem * 100) / 100,
    contratos_total: contratosTotal,
    contratos_finalizados: contratosFinalizados,
    contratos_pendentes: contratosPendentes,
    capital_total: capitalTotal,
    capital_disponivel: capitalDisponivel,
    capital_em_operacao: capitalEmOperacao,
    capital_travado: capitalTravado,
    distribuicao_lucro: distribuicaoLucro,
    snapshot_completo: {
      gerado_em: new Date().toISOString(),
      mes: mes_referencia,
      financeiro: { receita: receitaTotal, despesas: despesasTotal, lucro: lucroLiquido, margem },
      contratos: { total: contratosTotal, finalizados: contratosFinalizados, pendentes: contratosPendentes, lista: contratosLista },
      despesas: despesas || [],
      capital: { total: capitalTotal, disponivel: capitalDisponivel, em_operacao: capitalEmOperacao, travado: capitalTravado },
      distribuicao_lucro: distribuicaoLucro,
    },
    criado_em: existing?.criado_em || new Date().toISOString(),
    fechado_por: fechado_por || null,
  }

  // Salvar snapshot imutável
  await writeJSON(`closures/${mes_referencia}.json`, closure)

  // ── Transportar pendências ───────────────────────────────────────────────────
  const mesDestinoStr = `${proximoMes.getFullYear()}-${String(proximoMes.getMonth() + 1).padStart(2, '0')}`
  const pendentes = contratosLista.filter(c => c.status !== 'finalizado')

  if (pendentes.length > 0) {
    const existingCarryover = await readJSON<CarryoverItem[]>(`carryover/${mesDestinoStr}.json`) || []
    const novosItens: CarryoverItem[] = pendentes.map(c => ({
      id: crypto.randomUUID(),
      mes_origem: mes_referencia,
      mes_destino: mesDestinoStr,
      tipo: c.status === 'judicializado' ? 'capital_judicializado' : 'contrato_pendente',
      referencia_id: c.id,
      valor: Number(c.capital) || 0,
      descricao: `${c.nome} — ${c.servico}`,
      status: 'pendente',
      criado_em: new Date().toISOString(),
    }))
    await writeJSON(`carryover/${mesDestinoStr}.json`, [...existingCarryover, ...novosItens])
  }

  // Garantir mês destino como 'open'
  const destinoExisting = await readJSON<Closure>(`closures/${mesDestinoStr}.json`)
  if (!destinoExisting) {
    await writeJSON(`closures/${mesDestinoStr}.json`, {
      id: crypto.randomUUID(), mes_referencia: mesDestinoStr, data_fechamento: null,
      status: 'open', receita_total: 0, despesas_totais: 0, lucro_liquido: 0, margem: 0,
      contratos_total: 0, contratos_finalizados: 0, contratos_pendentes: 0,
      capital_total: 0, capital_disponivel: 0, capital_em_operacao: 0, capital_travado: 0,
      distribuicao_lucro: [], snapshot_completo: {}, criado_em: new Date().toISOString(),
    })
  }

  return NextResponse.json({ success: true, closure, carryover_gerado: pendentes.length, mes_destino: mesDestinoStr })
}

// ─── PUT: reabrir mês com motivo ──────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const { mes_referencia, motivo } = await req.json()
  if (!mes_referencia) return NextResponse.json({ error: 'mes_referencia obrigatório' }, { status: 400 })
  if (!motivo) return NextResponse.json({ error: 'Motivo obrigatório para reabertura.' }, { status: 400 })

  await ensureBucket()
  const existing = await readJSON<Closure>(`closures/${mes_referencia}.json`)
  if (!existing) return NextResponse.json({ error: 'Mês não encontrado.' }, { status: 404 })

  const updated = {
    ...existing,
    status: 'open' as const,
    snapshot_completo: {
      ...(existing.snapshot_completo as object),
      reabertura: { motivo, data: new Date().toISOString() },
    },
  }
  await writeJSON(`closures/${mes_referencia}.json`, updated)
  return NextResponse.json({ success: true })
}
