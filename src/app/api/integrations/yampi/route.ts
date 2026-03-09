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

    while (page <= maxPages) {
      const res = await axios.get(baseUrl, {
        headers,
        params: { limit: 100, page },
      })
      const orders: any[] = res.data.data || []
      if (orders.length === 0) break

      let passedStartDate = false
      for (const o of orders) {
        const dateStr = (o.created_at?.date || o.created_at || '').slice(0, 10)
        if (startDate && dateStr < startDate) {
          passedStartDate = true
          break
        }
        if (!endDate || dateStr <= endDate) {
          allOrders.push(o)
        }
      }

      if (passedStartDate) break
      page++
    }

    // status 4 = pago, status 6 = enviado (já pago e em transporte)
    const paidOrders = allOrders.filter((o: any) => o.status_id === 4 || o.status_id === 6)

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
