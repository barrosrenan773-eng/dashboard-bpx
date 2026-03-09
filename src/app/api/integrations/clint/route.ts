import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  try {
    const headers = {
      'api-token': process.env.CLINT_API_KEY,
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

    // Busca leads criados no período
    const leadsRes = await axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: leadsParams })
    const totalLeads: number = leadsRes.data.totalCount || 0

    // Busca todos os deals ganhos no período (todas as páginas)
    const wonFirstRes = await axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: wonParams })
    const wonTotalPages: number = wonFirstRes.data.totalPages || 1
    let wonDeals: any[] = [...(wonFirstRes.data.data || [])]

    if (wonTotalPages > 1) {
      const requests = []
      for (let p = 2; p <= Math.min(wonTotalPages, 20); p++) {
        requests.push(
          axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: { ...wonParams, page: p } })
            .then(r => r.data.data || [])
        )
      }
      const results = await Promise.all(requests)
      results.forEach(r => wonDeals = wonDeals.concat(r))
    }

    const totalValue = wonDeals.reduce((sum: number, d: any) => {
      const val = String(d.value || 0).replace(',', '.')
      return sum + (parseFloat(val) || 0)
    }, 0)

    // Busca todos os leads do período para breakdown por vendedor
    const allLeadsPages = Math.min(leadsRes.data.totalPages || 1, 20)
    let allLeads: any[] = [...(leadsRes.data.data || [])]
    if (allLeadsPages > 1) {
      const reqs = []
      for (let p = 2; p <= allLeadsPages; p++) {
        reqs.push(axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: { ...leadsParams, page: p } }).then(r => r.data.data || []))
      }
      const pages = await Promise.all(reqs)
      pages.forEach(p => allLeads = allLeads.concat(p))
    }

    // Busca leads de hoje por vendedor
    const hoje = endDate || new Date().toISOString().slice(0, 10)
    const hojeParams = {
      per_page: 200,
      page: 1,
      'created_at_start': `${hoje}T00:00:00.000000+00:00`,
      'created_at_end': `${hoje}T23:59:59.000000+00:00`,
    }
    const hojeRes = await axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: hojeParams })
    const leadsHoje: any[] = hojeRes.data.data || []
    const totalLeadsHoje = hojeRes.data.totalCount || leadsHoje.length

    // Agrega leads de hoje por vendedor
    const leadsHojePorVendedor: Record<string, number> = {}
    for (const d of leadsHoje) {
      const name = d.user?.full_name || d.user?.email || 'Sem vendedor'
      leadsHojePorVendedor[name] = (leadsHojePorVendedor[name] || 0) + 1
    }

    // Agrega por vendedor (período completo)
    const byVendedor: Record<string, { name: string; leads: number; won: number; revenue: number }> = {}
    for (const d of allLeads) {
      const name = d.user?.full_name || d.user?.email || 'Sem vendedor'
      if (!byVendedor[name]) byVendedor[name] = { name, leads: 0, won: 0, revenue: 0 }
      byVendedor[name].leads++
      if (d.status?.toUpperCase() === 'WON') {
        byVendedor[name].won++
        const val = String(d.value || 0).replace(',', '.')
        byVendedor[name].revenue += parseFloat(val) || 0
      }
    }

    const vendedores = Object.values(byVendedor)
      .map(v => ({
        ...v,
        leadsHoje: leadsHojePorVendedor[v.name] || 0,
        conversao: v.leads > 0 ? (v.won / v.leads) * 100 : 0,
        ticket: v.won > 0 ? v.revenue / v.won : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      totalLeads,
      wonDeals: wonFirstRes.data.totalCount || wonDeals.length,
      revenue: totalValue,
      conversionRate: totalLeads > 0 ? ((wonFirstRes.data.totalCount || wonDeals.length) / totalLeads) * 100 : 0,
      avgTicket: wonDeals.length > 0 ? totalValue / wonDeals.length : 0,
      totalLeadsHoje,
      vendedores,
      raw: wonDeals.slice(0, 10),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados do CLINT CRM', details: error.message },
      { status: 500 }
    )
  }
}
