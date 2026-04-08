import { NextResponse } from 'next/server'
import axios from 'axios'

export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  try {
    const headers = {
      'api-token': process.env.CLINT_API_TOKEN,
      'Content-Type': 'application/json',
    }

    // Parâmetros para leads criados no período (para contar leads e conversão)
    const leadsParams: any = { per_page: 200, page: 1 }
    if (startDate) leadsParams['created_at_start'] = `${startDate}T00:00:00.000000+00:00`
    if (endDate) leadsParams['created_at_end'] = `${endDate}T23:59:59.000000+00:00`

    // Parâmetros para deals ganhos no período (para receita real do mês)
    const wonParams: any = { per_page: 200, page: 1, status: 'WON' }
    if (startDate) wonParams['won_at_start'] = `${startDate}T00:00:00.000000+00:00`
    if (endDate) wonParams['won_at_end'] = `${endDate}T23:59:59.000000+00:00`

    const hoje = endDate || new Date().toISOString().slice(0, 10)
    const hojeParams = {
      per_page: 200, page: 1,
      'created_at_start': `${hoje}T00:00:00.000000+00:00`,
      'created_at_end': `${hoje}T23:59:59.000000+00:00`,
    }

    // Busca em paralelo: totais de leads, won e leads de hoje (apenas primeira página de cada)
    const [leadsRes, wonRes, hojeRes] = await Promise.all([
      axios.get(`https://api.clint.digital/v1/deals`, { headers, params: { ...leadsParams, per_page: 200 } }),
      axios.get(`https://api.clint.digital/v1/deals`, { headers, params: { ...wonParams, per_page: 200 } }),
      axios.get(`https://api.clint.digital/v1/deals`, { headers, params: hojeParams }),
    ])

    const totalWon: number = wonRes.data.totalCount || 0

    // Busca todas as páginas de won deals, leads do mês e leads de hoje em paralelo
    let wonDeals: any[] = [...(wonRes.data.data || [])]
    let allLeads: any[] = [...(leadsRes.data.data || [])]
    let allLeadsHoje: any[] = [...(hojeRes.data.data || [])]

    const wonTotalPages = wonRes.data.totalPages || 1
    const leadsTotalPages = leadsRes.data.totalPages || 1
    const hojeTotalPages = hojeRes.data.totalPages || 1

    const extraRequests: Promise<{ type: 'won' | 'leads' | 'hoje'; data: any[] }>[] = []

    for (let p = 2; p <= Math.min(wonTotalPages, 30); p++) {
      extraRequests.push(
        axios.get(`https://api.clint.digital/v1/deals`, { headers, params: { ...wonParams, per_page: 200, page: p } })
          .then(r => ({ type: 'won' as const, data: r.data.data || [] }))
      )
    }
    for (let p = 2; p <= Math.min(leadsTotalPages, 50); p++) {
      extraRequests.push(
        axios.get(`https://api.clint.digital/v1/deals`, { headers, params: { ...leadsParams, per_page: 200, page: p } })
          .then(r => ({ type: 'leads' as const, data: r.data.data || [] }))
      )
    }
    for (let p = 2; p <= Math.min(hojeTotalPages, 10); p++) {
      extraRequests.push(
        axios.get(`https://api.clint.digital/v1/deals`, { headers, params: { ...hojeParams, per_page: 200, page: p } })
          .then(r => ({ type: 'hoje' as const, data: r.data.data || [] }))
      )
    }

    const extraResults = await Promise.all(extraRequests)
    for (const r of extraResults) {
      if (r.type === 'won') wonDeals = wonDeals.concat(r.data)
      else if (r.type === 'leads') allLeads = allLeads.concat(r.data)
      else allLeadsHoje = allLeadsHoje.concat(r.data)
    }

    let totalValue = 0
    const byVendedor: Record<string, { name: string; leads: number; won: number; revenue: number }> = {}

    for (const d of wonDeals) {
      const name = d.user?.full_name || d.user?.email || 'Sem vendedor'
      if (!byVendedor[name]) byVendedor[name] = { name, leads: 0, won: 0, revenue: 0 }
      byVendedor[name].won++
      const val = String(d.value || 0).replace(',', '.')
      const v = parseFloat(val) || 0
      byVendedor[name].revenue += v
      totalValue += v
    }

    // Agrega leads por vendedor deduplicando por telefone (evita duplicatas de automação)
    const leadsSeenByVendedor: Record<string, Set<string>> = {}
    for (const d of allLeads) {
      const name = d.user?.full_name || d.user?.email || 'Sem vendedor'
      const phone = d.contact?.phone
      if (!phone) continue // ignora leads sem telefone (ruído de automação)
      if (!leadsSeenByVendedor[name]) leadsSeenByVendedor[name] = new Set()
      if (leadsSeenByVendedor[name].has(phone)) continue // duplicata, ignora
      leadsSeenByVendedor[name].add(phone)
      if (!byVendedor[name]) byVendedor[name] = { name, leads: 0, won: 0, revenue: 0 }
      byVendedor[name].leads++
    }

    // Leads de hoje por vendedor (também deduplicados por telefone)
    const leadsHojePorVendedor: Record<string, number> = {}
    const leadsHojeSeenByVendedor: Record<string, Set<string>> = {}
    for (const d of allLeadsHoje) {
      const name = d.user?.full_name || d.user?.email || 'Sem vendedor'
      const phone = d.contact?.phone
      if (!phone) continue
      if (!leadsHojeSeenByVendedor[name]) leadsHojeSeenByVendedor[name] = new Set()
      if (leadsHojeSeenByVendedor[name].has(phone)) continue
      leadsHojeSeenByVendedor[name].add(phone)
      leadsHojePorVendedor[name] = (leadsHojePorVendedor[name] || 0) + 1
    }

    const vendedores = Object.values(byVendedor)
      .map(v => ({
        ...v,
        leadsHoje: leadsHojePorVendedor[v.name] || 0,
        conversao: v.leads > 0 ? (v.won / v.leads) * 100 : 0,
        ticket: v.won > 0 ? v.revenue / v.won : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const totalLeadsDedup = vendedores.reduce((s, v) => s + v.leads, 0)
    const totalLeadsHojeDedup = Object.values(leadsHojePorVendedor).reduce((s, v) => s + v, 0)

    return NextResponse.json({
      totalLeads: totalLeadsDedup,
      wonDeals: totalWon,
      revenue: totalValue,
      conversionRate: totalLeadsDedup > 0 ? (totalWon / totalLeadsDedup) * 100 : 0,
      avgTicket: wonDeals.length > 0 ? totalValue / wonDeals.length : 0,
      totalLeadsHoje: totalLeadsHojeDedup,
      vendedores,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados do CLINT CRM', details: error.message },
      { status: 500 }
    )
  }
}
