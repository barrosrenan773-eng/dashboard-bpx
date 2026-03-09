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

    const wonParams: any = { per_page: 200, page: 1, status: 'WON' }
    if (startDate) wonParams['won_at_start'] = `${startDate}T00:00:00.000000+00:00`
    if (endDate) wonParams['won_at_end'] = `${endDate}T23:59:59.000000+00:00`

    // Busca todos os deals ganhos (todas as páginas)
    const firstRes = await axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: wonParams })
    const totalPages = Math.min(firstRes.data.totalPages || 1, 20)
    let wonDeals: any[] = [...(firstRes.data.data || [])]

    if (totalPages > 1) {
      const reqs = []
      for (let p = 2; p <= totalPages; p++) {
        reqs.push(
          axios.get(`${process.env.CLINT_BASE_URL}/v1/deals`, { headers, params: { ...wonParams, page: p } })
            .then(r => r.data.data || [])
        )
      }
      const pages = await Promise.all(reqs)
      pages.forEach(p => wonDeals = wonDeals.concat(p))
    }

    // Agrega por nome do deal (= produto/serviço vendido no CRM)
    const byProduct: Record<string, { name: string; deals: number; revenue: number; vendedores: Set<string> }> = {}

    for (const d of wonDeals) {
      const name = d.fields?.produto || d.name || d.title || 'Sem produto'
      const val = parseFloat(String(d.value || 0).replace(',', '.')) || 0
      const vendedor = d.user?.full_name || d.user?.email || 'Sem vendedor'

      if (!byProduct[name]) byProduct[name] = { name, deals: 0, revenue: 0, vendedores: new Set() }
      byProduct[name].deals++
      byProduct[name].revenue += val
      byProduct[name].vendedores.add(vendedor)
    }

    const produtos = Object.values(byProduct)
      .map(p => ({
        name: p.name,
        deals: p.deals,
        revenue: p.revenue,
        avgTicket: p.deals > 0 ? p.revenue / p.deals : 0,
        vendedores: p.vendedores.size,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({ produtos, totalDeals: wonDeals.length })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar produtos do CLINT', details: error.message },
      { status: 500 }
    )
  }
}
