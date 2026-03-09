import { NextResponse } from 'next/server'
import axios from 'axios'

const LOJAS = [
  { key: 'eros', alias: process.env.YAMPI_EROS_ALIAS, token: process.env.YAMPI_EROS_TOKEN, secret: process.env.YAMPI_EROS_SECRET_KEY },
  { key: 'bn', alias: process.env.YAMPI_BN_ALIAS, token: process.env.YAMPI_BN_TOKEN, secret: process.env.YAMPI_BN_SECRET_KEY },
  { key: 'farma', alias: process.env.YAMPI_FARMA_ALIAS, token: process.env.YAMPI_FARMA_TOKEN, secret: process.env.YAMPI_FARMA_SECRET_KEY },
]

async function fetchLojaOrders(loja: typeof LOJAS[0], startDate: string, endDate: string) {
  if (!loja.alias || !loja.token) return []

  const headers = { 'User-Token': loja.token, 'User-Secret-Key': loja.secret }
  const baseUrl = `https://api.dooki.com.br/v2/${loja.alias}/orders`

  let allOrders: any[] = []
  let page = 1

  while (page <= 100) {
    const res = await axios.get(baseUrl, { headers, params: { limit: 100, page, include: 'items' } })
    const orders: any[] = res.data.data || []
    if (orders.length === 0) break

    let passedStart = false
    for (const o of orders) {
      const dateStr = (o.created_at?.date || o.created_at || '').slice(0, 10)
      if (startDate && dateStr < startDate) { passedStart = true; break }
      if (!endDate || dateStr <= endDate) {
        if ([3, 4, 6, 7, 10].includes(o.status_id)) allOrders.push(o)
      }
    }

    if (passedStart) break
    page++
  }

  return allOrders
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  try {
    // Busca todas as lojas configuradas em paralelo
    const results = await Promise.all(
      LOJAS.map(l => fetchLojaOrders(l, startDate, endDate).catch(() => []))
    )
    const allOrders = results.flat()

    // Agrega por produto
    const byProduct: Record<string, { name: string; sku: string; orders: number; quantity: number; revenue: number; loja: string }> = {}

    for (const order of allOrders) {
      const items: any[] = order.items?.data || order.items || []
      for (const item of items) {
        const name = item.sku?.data?.title || item.name || item.product_name || item.item_sku || 'Produto desconhecido'
        const sku = item.item_sku || ''
        const qty = parseInt(item.quantity || item.qty || 1)
        const price = parseFloat(item.price || item.unit_price || 0)
        const revenue = price * qty

        if (!byProduct[name]) byProduct[name] = { name, sku, orders: 0, quantity: 0, revenue: 0, loja: '' }
        byProduct[name].orders++
        byProduct[name].quantity += qty
        byProduct[name].revenue += revenue
      }
    }

    const produtos = Object.values(byProduct)
      .map(p => ({
        ...p,
        avgTicket: p.orders > 0 ? p.revenue / p.orders : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({ produtos, totalOrders: allOrders.length })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar produtos da Yampi', details: error.message },
      { status: 500 }
    )
  }
}
