import { NextResponse } from 'next/server'
import axios from 'axios'

const LOJAS: Record<string, { alias: string; token: string; secret: string }> = {
  eros: {
    alias: process.env.YAMPI_EROS_ALIAS || '',
    token: process.env.YAMPI_EROS_TOKEN || '',
    secret: process.env.YAMPI_EROS_SECRET_KEY || '',
  },
  'barba-negra': {
    alias: process.env.YAMPI_BN_ALIAS || '',
    token: process.env.YAMPI_BN_TOKEN || '',
    secret: process.env.YAMPI_BN_SECRET_KEY || '',
  },
  farma: {
    alias: process.env.YAMPI_FARMA_ALIAS || '',
    token: process.env.YAMPI_FARMA_TOKEN || '',
    secret: process.env.YAMPI_FARMA_SECRET_KEY || '',
  },
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const loja = searchParams.get('loja') || ''
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  const creds = LOJAS[loja]
  if (!creds || !creds.alias || !creds.token) {
    return NextResponse.json({ error: `Credenciais da loja "${loja}" não configuradas` }, { status: 400 })
  }

  try {
    const headers = {
      'User-Token': creds.token,
      'User-Secret-Key': creds.secret,
    }
    const baseUrl = `https://api.dooki.com.br/v2/${creds.alias}/orders`

    let allOrders: any[] = []
    let page = 1
    const maxPages = 100

    while (page <= maxPages) {
      const res = await axios.get(baseUrl, { headers, params: { limit: 100, page } })
      const orders: any[] = res.data.data || []
      if (orders.length === 0) break

      for (const o of orders) {
        const dateStr = (o.created_at?.date || o.created_at || '').slice(0, 10)
        if (startDate && endDate && dateStr >= startDate && dateStr <= endDate) {
          allOrders.push(o)
        }
      }

      // Verifica se a página mais antiga já passou do startDate
      const lastDate = (orders[orders.length - 1]?.created_at?.date || orders[orders.length - 1]?.created_at || '').slice(0, 10)
      if (startDate && lastDate < startDate) break

      const meta = res.data.meta?.pagination
      if (!meta || page >= meta.total_pages) break
      page++
    }

    // status 3 = aprovado, 4 = pago, 6 = enviado, 7 = entregue
    const paid = allOrders.filter((o: any) => [3, 4, 6, 7, 10].includes(o.status_id))
    const revenue = paid.reduce((s: number, o: any) => s + parseFloat(o.value_total || 0), 0)
    const orders = paid.length
    const avgTicket = orders > 0 ? revenue / orders : 0

    // Dados diários para gráfico
    const byDate: Record<string, { revenue: number; orders: number }> = {}
    for (const o of paid) {
      const date = (o.created_at?.date || o.created_at || '').slice(0, 10)
      if (!byDate[date]) byDate[date] = { revenue: 0, orders: 0 }
      byDate[date].revenue += parseFloat(o.value_total || 0)
      byDate[date].orders++
    }
    const daily = Object.entries(byDate)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ revenue, orders, avgTicket, daily })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados da Yampi', details: error.message },
      { status: 500 }
    )
  }
}
