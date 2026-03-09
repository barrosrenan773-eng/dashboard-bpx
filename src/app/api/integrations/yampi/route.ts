import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  try {
    const headers = {
      'User-Token': process.env.YAMPI_EROS_TOKEN,
      'User-Secret-Key': process.env.YAMPI_EROS_SECRET_KEY,
    }
    const baseUrl = `https://api.dooki.com.br/v2/${process.env.YAMPI_EROS_ALIAS}/orders`

    let allOrders: any[] = []
    let page = 1
    const maxPages = 100

    const lookbackDate = startDate
      ? new Date(new Date(startDate).getTime() - 14 * 86400000).toISOString().slice(0, 10)
      : ''

    while (page <= maxPages) {
      const res = await axios.get(baseUrl, { headers, params: { limit: 100, page } })
      const orders: any[] = res.data.data || []
      if (orders.length === 0) break
      allOrders = allOrders.concat(orders)

      const lastDate = (orders[orders.length - 1]?.created_at?.date || orders[orders.length - 1]?.created_at || '').trim().slice(0, 10)
      if (lookbackDate && lastDate < lookbackDate) break

      const meta = res.data.meta?.pagination
      if (!meta || page >= meta.total_pages) break
      page++
    }

    const paidOrders = allOrders.filter((o: any) => {
      if (![3, 4, 6, 7, 10].includes(o.status_id)) return false
      const txns: any[] = o.transactions?.data || []
      const paidTxn = txns.find((t: any) => t.status === 'paid' && t.captured_at)
      if (!paidTxn) return false
      const capturedDate = (paidTxn.captured_at?.date || paidTxn.captured_at || '').trim().slice(0, 10)
      return capturedDate >= startDate && capturedDate <= endDate
    })

    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + parseFloat(o.value_total || 0), 0)
    const totalOrders = paidOrders.length
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return NextResponse.json({
      revenue: totalRevenue,
      orders: totalOrders,
      avgTicket,
      raw: paidOrders.slice(0, 10),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados da Yampi', details: error.message },
      { status: 500 }
    )
  }
}
