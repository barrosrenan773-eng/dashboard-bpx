import { NextResponse } from 'next/server'
import axios from 'axios'

export const dynamic = 'force-dynamic'

const CAMPANHAS_MANIPULACAO = [
  'P-Max [MANIPULAÇÃO]',
  'Campanha de Pesquisa [MANIPULAÇÃO] [INSTITUCIONAL]',
]

// Gasto dividido 50/50 entre Gabrielly e Amanda
const VENDEDORES_DIVISAO = ['Gabrielly Oliveira', 'Amanda Oliveira']

async function getAccessToken() {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  })
  return res.data.access_token as string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start e end são obrigatórios' }, { status: 400 })
  }

  try {
    const accessToken = await getAccessToken()
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '')
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!

    const query = `
      SELECT campaign.name, metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
    `

    const res = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
      { query: query.trim() },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
      }
    )

    const rows: any[] = res.data.results || []

    // Soma gasto das campanhas de manipulação
    let totalSpend = 0
    for (const row of rows) {
      const name: string = row.campaign?.name || ''
      const isManipulacao = CAMPANHAS_MANIPULACAO.some(c =>
        name.toLowerCase().includes(c.toLowerCase().replace(/\[/g, '').replace(/\]/g, '').trim()) ||
        c.toLowerCase().includes(name.toLowerCase())
      ) || CAMPANHAS_MANIPULACAO.some(c => name === c)

      if (isManipulacao) {
        totalSpend += (row.metrics?.costMicros || 0) / 1_000_000
      }
    }

    // Divide 50/50
    const spendPorVendedor = totalSpend / VENDEDORES_DIVISAO.length
    const spendByVendedor: Record<string, number> = {}
    VENDEDORES_DIVISAO.forEach(v => { spendByVendedor[v] = spendPorVendedor })

    return NextResponse.json({ totalSpend, spendByVendedor })
  } catch (error: any) {
    const details = error.response?.data || error.message
    return NextResponse.json(
      { error: 'Erro ao buscar Google Ads', details },
      { status: 500 }
    )
  }
}
