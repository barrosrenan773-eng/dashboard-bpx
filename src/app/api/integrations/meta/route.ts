import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/insights`,
      {
        params: {
          access_token: process.env.META_ACCESS_TOKEN,
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          fields: 'spend,impressions,clicks,actions,action_values,cpc,cpm,ctr',
          level: 'account',
        },
      }
    )

    const data = response.data.data?.[0] || {}
    const purchases = data.actions?.find((a: any) => a.action_type === 'purchase')
    const purchaseValue = data.action_values?.find((a: any) => a.action_type === 'purchase')

    return NextResponse.json({
      spend: parseFloat(data.spend || 0),
      impressions: parseInt(data.impressions || 0),
      clicks: parseInt(data.clicks || 0),
      purchases: parseInt(purchases?.value || 0),
      revenue: parseFloat(purchaseValue?.value || 0),
      roas: parseFloat(purchaseValue?.value || 0) / parseFloat(data.spend || 1),
      cpc: parseFloat(data.cpc || 0),
      ctr: parseFloat(data.ctr || 0),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados do Meta Ads', details: error.message },
      { status: 500 }
    )
  }
}
