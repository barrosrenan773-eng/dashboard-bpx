const BASE = 'https://api.clint.digital/v1'

const EXCLUIR = ['marcelo', 'desconhecido', 'adriane', 'giulia', 'thiago', 'reten', 'ia damatta', 'diretoria', 'bpx soluções', 'bpx solucoes', 'francisco', 'ingrid']

export function normalizarNome(n: string) {
  return n.replace(/#\d*\s*/g, '').replace(/[#@!]/g, '')
    .replace(/\s*[-–|·]?\s*(diretoria damatta)\s*/gi, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export function deveExcluir(nome: string) {
  return !nome || EXCLUIR.some(e => nome.toLowerCase().includes(e))
}

export type ClintDeal = {
  id: string
  won_at: string | null
  created_at: string | null
  value: number
  status: string
  user: { id: string; full_name: string; email: string }
  contact: { name: string }
  stage: string
  funnel?: { id: string; name: string }
  pipeline?: { id: string; name: string }
}

export type ConsultorData = {
  nome: string
  deals: number          // ganhos
  dealsPerdidos: number  // perdidos no período
  dealsAbertos: number   // abertos no período
  receita: number
  leads: number
  leadsHoje: number
  taxaConversao: number
  tempMedioFechamento: number // dias
}

// Busca deals paginando até o fim (máx 30 páginas × 100 = 3000 deals por chamada)
async function fetchDeals(token: string, extraParams: Record<string, string>, maxPages = 30): Promise<ClintDeal[]> {
  const all: ClintDeal[] = []
  let page = 1
  while (true) {
    const params = new URLSearchParams({ per_page: '100', page: String(page), ...extraParams })
    const res = await fetch(`${BASE}/deals?${params}`, {
      headers: { 'api-token': token },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) break
    const json = await res.json()
    const data: ClintDeal[] = json.data ?? []
    if (data.length === 0) break
    all.push(...data)
    if (!json.hasNext || page >= maxPages) break
    page++
  }
  return all
}

export async function fetchAllWon(token: string, startDate: string, endDate: string): Promise<ClintDeal[]> {
  // won_at usa offset BRT: BRT 00:00 = UTC 03:00; BRT 23:59 = próximo dia UTC 02:59
  return fetchDeals(token, {
    status: 'WON',
    won_at_start: `${startDate}T03:00:00.000000+00:00`,
    won_at_end:   (() => { const [y,mo,d] = endDate.split('-').map(Number); const nd = new Date(Date.UTC(y,mo-1,d+1)).toISOString().slice(0,10); return `${nd}T02:59:59.000000+00:00` })(),
  })
}

export async function fetchAllLost(token: string, startDate: string, endDate: string): Promise<ClintDeal[]> {
  try {
    const timeoutPromise = new Promise<ClintDeal[]>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 15000)
    )
    const fetchPromise = fetchDeals(token, {
      status: 'LOST',
      created_at_start: `${startDate}T03:00:00.000000+00:00`,
      created_at_end:   (() => { const [y,mo,d] = endDate.split('-').map(Number); const nd = new Date(Date.UTC(y,mo-1,d+1)).toISOString().slice(0,10); return `${nd}T02:59:59.000000+00:00` })(),
    }, 15)
    return await Promise.race([fetchPromise, timeoutPromise])
  } catch {
    return []
  }
}

// Brasil é fixo UTC-3 desde 2019 (sem horário de verão)
// Converte um timestamp UTC (ISO string) para a data em BRT (YYYY-MM-DD)
function utcToBRTDate(utcISO: string): string {
  return new Date(utcISO).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

// Retorna o início de um dia BRT como timestamp UTC para usar na API do Clint
// BRT 00:00:00 = UTC 03:00:00 do mesmo dia
function brtDayStartUTC(dateStr: string): string {
  return `${dateStr}T03:00:00.000000+00:00`
}

// Retorna o fim de um dia BRT como timestamp UTC para usar na API do Clint
// BRT 23:59:59 = UTC 02:59:59 do dia SEGUINTE
function brtDayEndUTC(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const nextDay = new Date(Date.UTC(y, mo - 1, d + 1))
  const nextDayStr = nextDay.toISOString().slice(0, 10)
  return `${nextDayStr}T02:59:59.000000+00:00`
}

export async function fetchLeadsDoMes(
  token: string, prefix: string, startDate?: string, endDate?: string
): Promise<{ totalLeads: number; leadsHoje: number; leadsPorConsultor: Record<string, { nome: string; leads: number; leadsHoje: number }> }> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [y, m] = prefix.split('-')
  const lastDay = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)
  const endDay   = endDate   ?? (today.startsWith(prefix) ? today : lastDay)
  const startDay = startDate ?? `${prefix}-01`
  // "hoje" para comparação: se filtrando período específico, usa o endDay; senão usa hoje real
  const diaReferencia = endDay

  // Usa offsets BRT corretos: início = BRT 00:00 = UTC 03:00; fim = BRT 23:59 = UTC+1dia 02:59
  const data = await fetchDeals(token, {
    created_at_start: brtDayStartUTC(startDay),
    created_at_end:   brtDayEndUTC(endDay),
  }) // usa default (30 páginas = 3000 leads)

  let totalLeads = 0
  let leadsHoje  = 0
  const leadsPorConsultor: Record<string, { nome: string; leads: number; leadsHoje: number }> = {}

  for (const d of data) {
    // Converte created_at (UTC) para data BRT antes de comparar
    const ca   = d.created_at ? utcToBRTDate(d.created_at) : ''
    const id   = d.user?.id ?? 'unknown'
    const nome = normalizarNome(d.user?.full_name ?? 'Desconhecido')
    if (deveExcluir(nome)) continue
    totalLeads++
    if (ca === diaReferencia) leadsHoje++
    if (!leadsPorConsultor[id]) leadsPorConsultor[id] = { nome, leads: 0, leadsHoje: 0 }
    leadsPorConsultor[id].leads++
    if (ca === diaReferencia) leadsPorConsultor[id].leadsHoje++
  }

  return { totalLeads, leadsHoje, leadsPorConsultor }
}

function calcularTempMedioFechamento(deals: ClintDeal[]): number {
  const diffs: number[] = []
  for (const d of deals) {
    if (!d.won_at || !d.created_at) continue
    const diasAbertura = (new Date(d.won_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (diasAbertura >= 0) diffs.push(diasAbertura)
  }
  return diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0
}

export async function fetchTodosUsuarios(token: string): Promise<{ id: string; nome: string }[]> {
  try {
    const res = await fetch(`${BASE}/users`, {
      headers: { 'api-token': token },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data ?? [])
      .map((u: { id: string; first_name: string; last_name: string }) => ({
        id: u.id,
        nome: normalizarNome(`${u.first_name} ${u.last_name}`.trim()),
      }))
      .filter((u: { id: string; nome: string }) => !deveExcluir(u.nome))
  } catch {
    return []
  }
}

export async function getConsultores(token: string, startDate: string, endDate: string, prefix: string, noLeads = false, noLost = false) {
  const emptyLeads = { totalLeads: 0, leadsHoje: 0, leadsPorConsultor: {} as Record<string, { nome: string; leads: number; leadsHoje: number }> }
  const [won, lost, leadsData, todosUsuarios] = await Promise.all([
    fetchAllWon(token, startDate, endDate),
    noLost ? Promise.resolve([]) : fetchAllLost(token, startDate, endDate),
    noLeads ? Promise.resolve(emptyLeads) : fetchLeadsDoMes(token, prefix, startDate, endDate),
    fetchTodosUsuarios(token),
  ])

  const { leadsPorConsultor } = leadsData
  const consultores: Record<string, ConsultorData & { _wonDeals: ClintDeal[] }> = {}

  // Indexar deals ganhos por consultor
  won.forEach(d => {
    const id   = d.user?.id ?? 'unknown'
    const nome = normalizarNome(d.user?.full_name ?? 'Desconhecido')
    if (deveExcluir(nome)) return
    if (!consultores[id]) consultores[id] = { nome, deals: 0, dealsPerdidos: 0, dealsAbertos: 0, receita: 0, leads: 0, leadsHoje: 0, taxaConversao: 0, tempMedioFechamento: 0, _wonDeals: [] }
    consultores[id].deals++
    consultores[id].receita += parseFloat(String(d.value)) || 0
    consultores[id]._wonDeals.push(d)
  })

  // Indexar deals perdidos por consultor
  lost.forEach(d => {
    const id   = d.user?.id ?? 'unknown'
    const nome = normalizarNome(d.user?.full_name ?? 'Desconhecido')
    if (deveExcluir(nome)) return
    if (!consultores[id]) consultores[id] = { nome, deals: 0, dealsPerdidos: 0, dealsAbertos: 0, receita: 0, leads: 0, leadsHoje: 0, taxaConversao: 0, tempMedioFechamento: 0, _wonDeals: [] }
    consultores[id].dealsPerdidos++
  })

  // Indexar leads por consultor
  Object.entries(leadsPorConsultor).forEach(([id, ldata]) => {
    if (deveExcluir(ldata.nome)) return
    if (!consultores[id]) consultores[id] = { nome: ldata.nome, deals: 0, dealsPerdidos: 0, dealsAbertos: 0, receita: 0, leads: 0, leadsHoje: 0, taxaConversao: 0, tempMedioFechamento: 0, _wonDeals: [] }
    consultores[id].leads     = ldata.leads
    consultores[id].leadsHoje = ldata.leadsHoje
    // dealsAbertos = leads - ganhos - perdidos
    const ganhos   = consultores[id].deals
    const perdidos = consultores[id].dealsPerdidos
    consultores[id].dealsAbertos = Math.max(0, ldata.leads - ganhos - perdidos)
    consultores[id].taxaConversao = ldata.leads > 0 ? (ganhos / ldata.leads) * 100 : 0
  })

  // Garantir que todos os usuários cadastrados na Clint apareçam, mesmo sem atividade
  todosUsuarios.forEach(u => {
    if (!consultores[u.id]) {
      consultores[u.id] = { nome: u.nome, deals: 0, dealsPerdidos: 0, dealsAbertos: 0, receita: 0, leads: 0, leadsHoje: 0, taxaConversao: 0, tempMedioFechamento: 0, _wonDeals: [] }
    }
  })

  // Calcular tempo médio de fechamento por consultor
  Object.values(consultores).forEach(c => {
    c.tempMedioFechamento = calcularTempMedioFechamento(c._wonDeals)
  })

  // Remover campo interno antes de retornar
  const lista = Object.values(consultores)
    .map(({ _wonDeals: _w, ...rest }) => rest)
    .sort((a, b) => b.receita - a.receita)

  return {
    consultores: lista,
    receita:     lista.reduce((s, c) => s + c.receita, 0),
    totalDeals:  lista.reduce((s, c) => s + c.deals, 0),
    totalLeads:  lista.reduce((s, c) => s + c.leads, 0),
    leadsHoje:   lista.reduce((s, c) => s + c.leadsHoje, 0),
    totalLost:   lista.reduce((s, c) => s + c.dealsPerdidos, 0),
  }
}
