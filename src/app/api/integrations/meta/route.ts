import { NextResponse } from 'next/server'
import axios from 'axios'

// Contas em USD precisam de conversão
const USD_ACCOUNTS = new Set([
  '25151603364536067', // B.M - G.D - BARBA NEGRA - USD
  '1399709115083658',  // B.M - G.D - DAMATTA EROS - USD
  '1598921041011616',  // GUSTAVO - EROS - USD
  '1405263997911642',  // B.M - G.D - VENDAS - USD
])

const LOJAS_ACCOUNTS: Record<string, string[]> = {
  eros: ['1399709115083658', '1598921041011616', '954527520205698'],
  'barba-negra': ['220219660264071', '25151603364536067'],
  vendedores: ['1405263997911642'],
}

async function getUsdBrl(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await res.json()
    return data.rates?.BRL || 5.80
  } catch {
    return 5.80
  }
}

async function fetchAccountInsights(accountId: string, startDate: string, endDate: string, token: string, usdBrl: number) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v19.0/act_${accountId}/insights`,
      {
        params: {
          access_token: token,
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          fields: 'spend,impressions,clicks,actions,action_values,cpc,cpm,ctr',
          level: 'account',
        },
      }
    )
    const data = res.data.data?.[0] || {}
    const purchases = data.actions?.find((a: any) => a.action_type === 'purchase')
    const purchaseValue = data.action_values?.find((a: any) => a.action_type === 'purchase')
    const fx = USD_ACCOUNTS.has(accountId) ? usdBrl : 1
    return {
      spend: parseFloat(data.spend || 0) * fx,
      impressions: parseInt(data.impressions || 0),
      clicks: parseInt(data.clicks || 0),
      purchases: parseInt(purchases?.value || 0),
      revenue: parseFloat(purchaseValue?.value || 0) * fx,
      cpc: parseFloat(data.cpc || 0) * fx,
      ctr: parseFloat(data.ctr || 0),
    }
  } catch {
    return { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, cpc: 0, ctr: 0 }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const loja = searchParams.get('loja') || ''
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 400 })
  }

  const accountIds = loja ? (LOJAS_ACCOUNTS[loja] || []) : Object.values(LOJAS_ACCOUNTS).flat()

  if (accountIds.length === 0) {
    return NextResponse.json({ error: `Loja "${loja}" não encontrada` }, { status: 400 })
  }

  try {
    const usdBrl = await getUsdBrl()

    const results = await Promise.all(
      accountIds.map(id => fetchAccountInsights(id, startDate, endDate, token, usdBrl))
    )

    const totals = results.reduce((acc, r) => ({
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      purchases: acc.purchases + r.purchases,
      revenue: acc.revenue + r.revenue,
    }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 })

    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0

    // Breakdown por site (apenas quando sem filtro de loja)
    const porSite: Record<string, { spend: number; purchases: number }> = {}
    if (!loja) {
      const SITE_NAMES: Record<string, string> = {
        eros: 'Damatta Eros',
        'barba-negra': 'Barba Negra',
      }
      for (const [lojaKey, ids] of Object.entries(LOJAS_ACCOUNTS)) {
        if (lojaKey === 'vendedores') continue
        const siteResults = await Promise.all(ids.map(id => fetchAccountInsights(id, startDate, endDate, token, usdBrl)))
        const st = siteResults.reduce((a, r) => ({ spend: a.spend + r.spend, purchases: a.purchases + r.purchases }), { spend: 0, purchases: 0 })
        porSite[SITE_NAMES[lojaKey] || lojaKey] = st
      }
    }

    return NextResponse.json({ ...totals, roas, cpc, ctr, usdBrl, porSite })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar dados do Meta Ads', details: error.message },
      { status: 500 }
    )
  }
}
