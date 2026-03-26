export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token = process.env.META_ADS_ACCESS_TOKEN
  const accountId = process.env.META_ADS_ACCOUNT_ID

  if (!token || !accountId) {
    return NextResponse.json({ error: 'Credenciais Meta Ads não configuradas' }, { status: 500 })
  }

  const mes = req.nextUrl.searchParams.get('mes')
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')
  let dateParam: string
  if (start && end) {
    dateParam = `time_range=${encodeURIComponent(JSON.stringify({ since: start, until: end }))}`
  } else if (mes) {
    const [y, m] = mes.split('-')
    const lastDay = new Date(Number(y), Number(m), 0).getDate()
    const timeRange = JSON.stringify({ since: `${mes}-01`, until: `${mes}-${String(lastDay).padStart(2, '0')}` })
    dateParam = `time_range=${encodeURIComponent(timeRange)}`
  } else {
    const date_preset = req.nextUrl.searchParams.get('date_preset') || 'this_month'
    dateParam = `date_preset=${date_preset}`
  }

  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend,impressions,clicks,cpc,cpm&${dateParam}&access_token=${token}`

  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json()

  if (json.error) {
    return NextResponse.json({ error: json.error.message }, { status: 400 })
  }

  const data = json.data?.[0] ?? null
  return NextResponse.json({
    spend: data ? parseFloat(data.spend) : 0,
    impressions: data ? parseInt(data.impressions) : 0,
    clicks: data ? parseInt(data.clicks) : 0,
    cpc: data ? parseFloat(data.cpc ?? 0) : 0,
    cpm: data ? parseFloat(data.cpm ?? 0) : 0,
    date_start: data?.date_start ?? null,
    date_stop: data?.date_stop ?? null,
  })
}
