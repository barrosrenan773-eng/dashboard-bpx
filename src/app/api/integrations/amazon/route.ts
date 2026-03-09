import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  // Amazon SP-API requer autenticação OAuth com LWA (Login with Amazon)
  // Esta é a estrutura base — configure as credenciais no .env.local
  try {
    // 1. Obter token LWA
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN || '',
        client_id: process.env.AMAZON_MWS_ACCESS_KEY || '',
        client_secret: process.env.AMAZON_MWS_SECRET_KEY || '',
      }),
    })

    const { access_token } = await tokenRes.json()

    // 2. Buscar relatório de pedidos
    const ordersRes = await fetch(
      `https://sellingpartnerapi-na.amazon.com/orders/v0/orders?MarketplaceIds=${process.env.AMAZON_MARKETPLACE_ID}&CreatedAfter=${startDate}&CreatedBefore=${endDate}&OrderStatuses=Shipped,Delivered`,
      {
        headers: {
          'x-amz-access-token': access_token,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await ordersRes.json()
    const orders = data.payload?.Orders || []

    const totalRevenue = orders.reduce(
      (sum: number, o: any) => sum + parseFloat(o.OrderTotal?.Amount || 0),
      0
    )

    return NextResponse.json({
      orders: orders.length,
      revenue: totalRevenue,
      avgTicket: orders.length > 0 ? totalRevenue / orders.length : 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados da Amazon', details: error.message },
      { status: 500 }
    )
  }
}
