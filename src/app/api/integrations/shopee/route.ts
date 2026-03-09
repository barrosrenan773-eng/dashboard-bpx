import { NextResponse } from 'next/server'
import crypto from 'crypto'
import axios from 'axios'

function generateShopeeSign(path: string, timestamp: number): string {
  const baseString = `${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}${process.env.SHOPEE_ACCESS_TOKEN}${process.env.SHOPEE_SHOP_ID}`
  return crypto
    .createHmac('sha256', process.env.SHOPEE_PARTNER_KEY!)
    .update(baseString)
    .digest('hex')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  const timestamp = Math.floor(Date.now() / 1000)
  const path = '/api/v2/order/get_order_list'
  const sign = generateShopeeSign(path, timestamp)

  try {
    const response = await axios.get('https://partner.shopeemobile.com/api/v2/order/get_order_list', {
      params: {
        partner_id: process.env.SHOPEE_PARTNER_ID,
        shop_id: process.env.SHOPEE_SHOP_ID,
        access_token: process.env.SHOPEE_ACCESS_TOKEN,
        timestamp,
        sign,
        time_range_field: 'create_time',
        time_from: Math.floor(new Date(startDate).getTime() / 1000),
        time_to: Math.floor(new Date(endDate).getTime() / 1000),
        page_size: 50,
        order_status: 'COMPLETED',
      },
    })

    const orders = response.data.response?.order_list || []

    return NextResponse.json({
      orders: orders.length,
      raw: orders.slice(0, 10),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados da Shopee', details: error.message },
      { status: 500 }
    )
  }
}
