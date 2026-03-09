import { NextResponse } from 'next/server'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

const PROPERTY_IDS: Record<string, string> = {
  eros: process.env.GA4_EROS_PROPERTY_ID || '',
  'barba-negra': process.env.GA4_BN_PROPERTY_ID || '',
  farma: process.env.GA4_FARMA_PROPERTY_ID || '',
}

function getClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada')
  const credentials = JSON.parse(keyJson)
  return new BetaAnalyticsDataClient({ credentials })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const loja = searchParams.get('loja') || ''
  const startDate = searchParams.get('start') || '30daysAgo'
  const endDate = searchParams.get('end') || 'today'

  const propertyId = PROPERTY_IDS[loja]
  if (!propertyId) {
    return NextResponse.json({ error: `Loja inválida ou GA4_${loja.toUpperCase().replace('-', '_')}_PROPERTY_ID não configurado` }, { status: 400 })
  }

  try {
    const client = getClient()

    // Totais do período
    const [totalResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
        { name: 'bounceRate' },
      ],
    })

    const totals = totalResponse.rows?.[0]?.metricValues || []
    const sessions = parseInt(totals[0]?.value || '0')
    const activeUsers = parseInt(totals[1]?.value || '0')
    const newUsers = parseInt(totals[2]?.value || '0')
    const purchases = parseInt(totals[3]?.value || '0')
    const purchaseRevenue = parseFloat(totals[4]?.value || '0')
    const bounceRate = parseFloat(totals[5]?.value || '0')
    const conversionRate = sessions > 0 ? (purchases / sessions) * 100 : 0

    // Breakdown por canal de aquisição (source/medium)
    const [channelResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    })

    const channels = (channelResponse.rows || []).map(row => ({
      channel: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      purchases: parseInt(row.metricValues?.[2]?.value || '0'),
      revenue: parseFloat(row.metricValues?.[3]?.value || '0'),
    }))

    // Dados diários para gráfico
    const [dailyResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    })

    const daily = (dailyResponse.rows || []).map(row => {
      const rawDate = row.dimensionValues?.[0]?.value || ''
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      return {
        date,
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        purchases: parseInt(row.metricValues?.[1]?.value || '0'),
        revenue: parseFloat(row.metricValues?.[2]?.value || '0'),
      }
    })

    return NextResponse.json({
      sessions,
      activeUsers,
      newUsers,
      purchases,
      purchaseRevenue,
      bounceRate,
      conversionRate,
      channels,
      daily,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados do GA4', details: error.message },
      { status: 500 }
    )
  }
}
