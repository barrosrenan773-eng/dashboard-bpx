export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getConsultores } from '@/lib/clint'

const BASE = 'https://api.clint.digital/v1'

// Cache em memória: evita refetch se os mesmos params foram pedidos < 5 min atrás
const cache = new Map<string, { data: unknown; at: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export async function GET(req: NextRequest) {
  const token = (process.env.CLINT_API_TOKEN || process.env.CLINT_API_KEY || '').trim()
  if (!token) return NextResponse.json({ error: 'CLINT_API_TOKEN não configurado' }, { status: 500 })

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const mes = req.nextUrl.searchParams.get('mes') ?? (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const [y, m] = mes.split('-')
  const prefix = `${y}-${m.padStart(2, '0')}`

  const startDate = req.nextUrl.searchParams.get('start') || `${prefix}-01`
  const endDate = req.nextUrl.searchParams.get('end') || today
  const noLeads = req.nextUrl.searchParams.get('noLeads') === '1'
  const noLost  = req.nextUrl.searchParams.get('noLost')  === '1'
  const bust    = req.nextUrl.searchParams.get('bust')    === '1'

  if (req.nextUrl.searchParams.get('debug') === '1') {
    const res = await fetch(`${BASE}/deals?limit=2&status=WON&page=1`, {
      headers: { 'api-token': token }, cache: 'no-store',
    })
    const json = await res.json()
    return NextResponse.json(json)
  }

  if (req.nextUrl.searchParams.get('debug') === 'dimas-won2') {
    // Testa filtro por updated_stage_at em março (como CRM pode estar contando)
    const brtStart = '2026-03-01T03:00:00.000000+00:00'
    const brtEnd   = '2026-04-01T02:59:59.000000+00:00'
    const tests: any[] = []
    // Teste A: won_at em março (atual)
    const pA = new URLSearchParams({ per_page: '100', page: '1', status: 'WON', won_at_start: brtStart, won_at_end: brtEnd })
    const rA = await fetch(`${BASE}/deals?${pA}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const jA = await rA.json()
    const dimasA = (jA.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
    tests.push({ filtro: 'won_at_março', totalCount: jA.totalCount, dimasCount: dimasA.length })
    // Teste B: updated_stage_at em março
    const pB = new URLSearchParams({ per_page: '100', page: '1', status: 'WON', updated_stage_at_start: brtStart, updated_stage_at_end: brtEnd })
    const rB = await fetch(`${BASE}/deals?${pB}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const jB = await rB.json()
    const dimasB = (jB.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
    tests.push({ filtro: 'updated_stage_at_março', totalCount: jB.totalCount, dimasCount: dimasB.length })
    // Teste C: sem filtro status, só updated_stage_at em março (todos os deals que mudaram de estágio)
    const pC = new URLSearchParams({ per_page: '100', page: '1', updated_stage_at_start: brtStart, updated_stage_at_end: brtEnd })
    const rC = await fetch(`${BASE}/deals?${pC}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const jC = await rC.json()
    const dimasC = (jC.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
    tests.push({ filtro: 'todos_status_updated_stage_março', totalCount: jC.totalCount, hasNext: jC.hasNext, dimasCount: dimasC.length })
    return NextResponse.json(tests)
  }

  if (req.nextUrl.searchParams.get('debug') === 'dimas-won3') {
    // Busca todos os deals com updated_stage_at em março (todas páginas) e filtra WON em código
    const brtStart = '2026-03-01T03:00:00.000000+00:00'
    const brtEnd   = '2026-04-01T02:59:59.000000+00:00'
    const all: any[] = []
    for (let pg = 1; pg <= 15; pg++) {
      const p = new URLSearchParams({ per_page: '100', page: String(pg), updated_stage_at_start: brtStart, updated_stage_at_end: brtEnd })
      const r = await fetch(`${BASE}/deals?${p}`, { headers: { 'api-token': token }, cache: 'no-store' })
      const j = await r.json()
      all.push(...(j.data ?? []))
      if (!j.hasNext) break
    }
    const won = all.filter((d: any) => d.status === 'WON')
    const byUser: Record<string, { nome: string; count: number }> = {}
    for (const d of won) {
      const id = d.user?.id ?? 'unknown'
      const nome = d.user?.full_name ?? '?'
      if (!byUser[id]) byUser[id] = { nome, count: 0 }
      byUser[id].count++
    }
    const dimasDeals = won.filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
      .map((d: any) => ({ contact: d.contact?.name, won_at: d.won_at, updated_stage_at: d.updated_stage_at, value: d.value }))
    return NextResponse.json({ totalFetched: all.length, totalWON: won.length, byUser, dimasCount: dimasDeals.length, dimasDeals })
  }

  if (req.nextUrl.searchParams.get('debug') === 'dimas-won') {
    // Busca todos os deals WON de março sem filtro de won_at para ver o total real
    const brtStart = '2026-03-01T03:00:00.000000+00:00'
    const brtEnd   = '2026-04-01T02:59:59.000000+00:00'
    // Teste 1: filtro por won_at (como o dashboard faz)
    const p1 = new URLSearchParams({ per_page: '100', page: '1', status: 'WON', won_at_start: brtStart, won_at_end: brtEnd })
    const r1 = await fetch(`${BASE}/deals?${p1}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const j1 = await r1.json()
    const wonByWonAt = (j1.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
    // Teste 2: filtro por created_at (todos os deals criados em março)
    const p2 = new URLSearchParams({ per_page: '100', page: '1', status: 'WON', created_at_start: brtStart, created_at_end: brtEnd })
    const r2 = await fetch(`${BASE}/deals?${p2}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const j2 = await r2.json()
    const wonByCreatedAt = (j2.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
    // Teste 3: sem filtro de data, só status WON, pegar todos do Dimas
    const p3 = new URLSearchParams({ per_page: '100', page: '1', status: 'WON' })
    const r3 = await fetch(`${BASE}/deals?${p3}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const j3 = await r3.json()
    const wonAll = (j3.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
      .map((d: any) => ({ contact: d.contact?.name, won_at: d.won_at, created_at: d.created_at, value: d.value }))
    // Teste 4: buscar página 2 também (sem filtro data)
    const p4 = new URLSearchParams({ per_page: '100', page: '2', status: 'WON' })
    const r4 = await fetch(`${BASE}/deals?${p4}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const j4 = await r4.json()
    const wonAllP2 = (j4.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
      .map((d: any) => ({ contact: d.contact?.name, won_at: d.won_at, created_at: d.created_at, value: d.value }))
    // Teste 5: won_at sem offset BRT (UTC puro 00:00 a 23:59)
    const p5 = new URLSearchParams({ per_page: '100', page: '1', status: 'WON', won_at_start: '2026-03-01T00:00:00.000000+00:00', won_at_end: '2026-03-31T23:59:59.000000+00:00' })
    const r5 = await fetch(`${BASE}/deals?${p5}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const j5 = await r5.json()
    const wonUTC = (j5.data ?? []).filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('dimas'))
    return NextResponse.json({
      wonAtFilter_BRT: { totalCount: j1.totalCount, totalPages: j1.totalPages, dimasCount: wonByWonAt.length },
      createdAtFilter: { totalCount: j2.totalCount, totalPages: j2.totalPages, dimasCount: wonByCreatedAt.length },
      semFiltro_p1: { totalCount: j3.totalCount, totalPages: j3.totalPages, dimasCount: wonAll.length, deals: wonAll },
      semFiltro_p2: { dimasCount: wonAllP2.length, deals: wonAllP2 },
      wonAtFilter_UTC: { totalCount: j5.totalCount, totalPages: j5.totalPages, dimasCount: wonUTC.length },
    })
  }

  if (req.nextUrl.searchParams.get('debug') === 'leads') {
    // Debug: fetch today's leads directly to check count vs Clint dashboard
    const brtToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const [ty, tmo, td] = brtToday.split('-').map(Number)
    const nextDay = new Date(Date.UTC(ty, tmo - 1, td + 1)).toISOString().slice(0, 10)
    const start = `${brtToday}T03:00:00.000000+00:00`
    const end   = `${nextDay}T02:59:59.000000+00:00`
    const params = new URLSearchParams({ per_page: '100', page: '1', created_at_start: start, created_at_end: end })
    const res = await fetch(`${BASE}/deals?${params}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const json = await res.json()
    const byUser: Record<string, { nome: string; count: number }> = {}
    for (const d of json.data ?? []) {
      const id = d.user?.id ?? 'unknown'
      if (!byUser[id]) byUser[id] = { nome: d.user?.full_name ?? '?', count: 0 }
      byUser[id].count++
    }
    return NextResponse.json({ brtToday, start, end, totalCount: json.totalCount, totalPages: json.totalPages, page1Count: (json.data ?? []).length, byUser })
  }

  if (req.nextUrl.searchParams.get('debug') === 'leonardo') {
    const brtToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const [ty, tmo, td] = brtToday.split('-').map(Number)
    const nextDay = new Date(Date.UTC(ty, tmo - 1, td + 1)).toISOString().slice(0, 10)
    const start = `${brtToday}T03:00:00.000000+00:00`
    const end   = `${nextDay}T02:59:59.000000+00:00`
    const params = new URLSearchParams({ per_page: '100', page: '1', created_at_start: start, created_at_end: end })
    const res = await fetch(`${BASE}/deals?${params}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const json = await res.json()
    const leads = (json.data ?? [])
      .filter((d: any) => (d.user?.full_name ?? '').toLowerCase().includes('leonardo'))
      .map((d: any) => ({
        id: d.id,
        contact: d.contact?.name,
        phone: d.contact?.phone ?? null,
        created_at_utc: d.created_at,
        status: d.status,
      }))
    return NextResponse.json({ brtToday, start, end, count: leads.length, leads })
  }

  if (req.nextUrl.searchParams.get('debug') === 'leads-utc') {
    // Debug: fetch today's leads using UTC 00:00-23:59 (old style) to compare with BRT offset
    const utcToday = new Date().toISOString().slice(0, 10)
    const start = `${utcToday}T00:00:00.000000+00:00`
    const end   = `${utcToday}T23:59:59.000000+00:00`
    const params = new URLSearchParams({ per_page: '100', page: '1', created_at_start: start, created_at_end: end })
    const res = await fetch(`${BASE}/deals?${params}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const json = await res.json()
    const byUser: Record<string, { nome: string; count: number }> = {}
    for (const d of json.data ?? []) {
      const id = d.user?.id ?? 'unknown'
      if (!byUser[id]) byUser[id] = { nome: d.user?.full_name ?? '?', count: 0 }
      byUser[id].count++
    }
    return NextResponse.json({ utcToday, start, end, totalCount: json.totalCount, totalPages: json.totalPages, page1Count: (json.data ?? []).length, byUser })
  }

  if (req.nextUrl.searchParams.get('debug') === 'leads-month') {
    // Debug: check total lead count for current month to see if pagination is cutting off data
    const brtToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const [ty, tmo, td] = brtToday.split('-').map(Number)
    const monthStart = `${ty}-${String(tmo).padStart(2, '0')}-01`
    const nextDay = new Date(Date.UTC(ty, tmo - 1, td + 1)).toISOString().slice(0, 10)
    const start = `${monthStart}T03:00:00.000000+00:00`
    const end   = `${nextDay}T02:59:59.000000+00:00`
    const params = new URLSearchParams({ per_page: '100', page: '1', created_at_start: start, created_at_end: end })
    const res = await fetch(`${BASE}/deals?${params}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const json = await res.json()
    return NextResponse.json({ brtToday, monthStart, totalCount: json.totalCount, totalPages: json.totalPages, maxFetchable: 1000, willTruncate: (json.totalCount ?? 0) > 1000 })
  }

  const cacheKey = `${startDate}|${endDate}|${noLeads}|${noLost}`

  if (!bust) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'no-store', 'X-Cache': 'HIT' },
      })
    }
  }

  try {
    const result = await getConsultores(token, startDate, endDate, prefix, noLeads, noLost)
    const taxaConversao = result.totalLeads > 0 ? (result.totalDeals / result.totalLeads) * 100 : 0

    const body = {
      mes,
      receita: result.receita,
      totalDeals: result.totalDeals,
      totalLeads: result.totalLeads,
      leadsHoje: result.leadsHoje,
      totalLost: result.totalLost,
      taxaConversao,
      consultores: result.consultores,
    }

    cache.set(cacheKey, { data: body, at: Date.now() })

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
