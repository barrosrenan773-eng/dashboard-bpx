const BASE = 'https://api.clint.digital/v1'

const EXCLUIR = ['marcelo', 'desconhecido', 'adriane', 'giulia', 'thiago', 'reten', 'ia damatta', 'diretoria']

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
  deals: number
  receita: number
  leads: number
  leadsHoje: number
  taxaConversao: number
}

export async function fetchAllWon(token: string, startDate: string, endDate: string): Promise<ClintDeal[]> {
  let allDeals: ClintDeal[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      per_page: '200',
      status: 'WON',
      page: String(page),
      won_at_start: `${startDate}T00:00:00.000000+00:00`,
      won_at_end: `${endDate}T23:59:59.000000+00:00`,
    })
    const res = await fetch(`${BASE}/deals?${params}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const json = await res.json()
    const data: ClintDeal[] = json.data ?? []
    if (data.length === 0) break
    allDeals.push(...data)
    if (!json.hasNext || page >= 100) break
    page++
  }

  return allDeals
}

export async function fetchLeadsDoMes(
  token: string, prefix: string, startDate?: string, endDate?: string
): Promise<{ totalLeads: number; leadsHoje: number; leadsPorConsultor: Record<string, { nome: string; leads: number; leadsHoje: number }> }> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [y, m] = prefix.split('-')
  const lastDay = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)
  const endDay = endDate ?? (today.startsWith(prefix) ? today : lastDay)
  const startDay = startDate ?? `${prefix}-01`

  let totalLeads = 0
  let leadsHoje = 0
  const leadsPorConsultor: Record<string, { nome: string; leads: number; leadsHoje: number }> = {}
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      per_page: '200',
      page: String(page),
      created_at_start: `${startDay}T00:00:00.000000+00:00`,
      created_at_end: `${endDay}T23:59:59.000000+00:00`,
    })
    const res = await fetch(`${BASE}/deals?${params}`, { headers: { 'api-token': token }, cache: 'no-store' })
    const json = await res.json()
    const data: ClintDeal[] = json.data ?? []
    if (data.length === 0) break

    for (const d of data) {
      const ca = d.created_at?.slice(0, 10) ?? ''
      totalLeads++
      if (ca === today) leadsHoje++
      const id = d.user?.id ?? 'unknown'
      const nome = normalizarNome(d.user?.full_name ?? 'Desconhecido')
      if (!leadsPorConsultor[id]) leadsPorConsultor[id] = { nome, leads: 0, leadsHoje: 0 }
      leadsPorConsultor[id].leads++
      if (ca === today) leadsPorConsultor[id].leadsHoje++
    }

    if (!json.hasNext || page >= 100) break
    page++
  }

  return { totalLeads, leadsHoje, leadsPorConsultor }
}

export async function getConsultores(token: string, startDate: string, endDate: string, prefix: string, noLeads = false) {
  const [won, leadsData] = await Promise.all([
    fetchAllWon(token, startDate, endDate),
    noLeads
      ? Promise.resolve({ totalLeads: 0, leadsHoje: 0, leadsPorConsultor: {} as Record<string, { nome: string; leads: number; leadsHoje: number }> })
      : fetchLeadsDoMes(token, prefix, startDate, endDate),
  ])

  const { leadsPorConsultor } = leadsData
  const consultores: Record<string, ConsultorData> = {}

  won.forEach(d => {
    const id = d.user?.id ?? 'unknown'
    const nome = normalizarNome(d.user?.full_name ?? 'Desconhecido')
    if (deveExcluir(nome)) return
    if (!consultores[id]) consultores[id] = { nome, deals: 0, receita: 0, leads: 0, leadsHoje: 0, taxaConversao: 0 }
    consultores[id].deals++
    consultores[id].receita += parseFloat(String(d.value)) || 0
  })

  Object.entries(leadsPorConsultor).forEach(([id, ldata]) => {
    if (deveExcluir(ldata.nome)) return
    if (!consultores[id]) consultores[id] = { nome: ldata.nome, deals: 0, receita: 0, leads: 0, leadsHoje: 0, taxaConversao: 0 }
    consultores[id].leads = ldata.leads
    consultores[id].leadsHoje = ldata.leadsHoje
    consultores[id].taxaConversao = ldata.leads > 0 ? (consultores[id].deals / ldata.leads) * 100 : 0
  })

  const lista = Object.values(consultores).sort((a, b) => b.receita - a.receita)
  return {
    consultores: lista,
    receita: lista.reduce((s, c) => s + c.receita, 0),
    totalDeals: lista.reduce((s, c) => s + c.deals, 0),
    totalLeads: lista.reduce((s, c) => s + c.leads, 0),
    leadsHoje: lista.reduce((s, c) => s + c.leadsHoje, 0),
  }
}
