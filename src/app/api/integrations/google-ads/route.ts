import { NextResponse } from 'next/server'
import { GoogleAdsApi } from 'google-ads-api'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Farma: divide 50/50 entre Gabrielly e Amanda
const FARMA_VENDEDORES = ['Gabrielly Oliveira', 'Amanda Oliveira']

// Campanhas de manipulação da conta Eros → divide entre Gabrielly e Amanda
const CAMPANHAS_MANIPULACAO_EROS = [
  'P-Max [MANIPULAÇÃO]',
  'Campanha de Pesquisa [MANIPULAÇÃO] [INSTITUCIONAL]',
]

// Campanhas da conta Farma que vão para Amanda/Gabrielly (restante vai para site Eros)
const CAMPANHAS_MANIPULACAO_FARMA = [
  'P-Max [MANIPULAÇÃO]',
  'Campanha de Pesquisa [MANIPULAÇÃO] [INSTITUCIONAL]',
]

const CONTAS = [
  { nome: 'Barba Negra', envKey: 'GOOGLE_ADS_CUSTOMER_ID_BN', site: 'Barba Negra' },
  { nome: 'Damatta Eros', envKey: 'GOOGLE_ADS_CUSTOMER_ID_EROS', site: 'Damatta Eros' },
  { nome: 'Damatta Farma', envKey: 'GOOGLE_ADS_CUSTOMER_ID_FARMA', site: 'Damatta Farma' },
]

async function getStoredRefreshToken(): Promise<string> {
  const { data } = await supabase
    .from('google_ads_tokens')
    .select('refresh_token')
    .eq('id', 1)
    .single()
  return data?.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN!
}

async function saveRefreshToken(token: string) {
  await supabase
    .from('google_ads_tokens')
    .upsert({ id: 1, refresh_token: token, updated_at: new Date().toISOString() })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start e end são obrigatórios' }, { status: 400 })
  }

  try {
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    })

    const mccId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, '')

    const refreshToken = await getStoredRefreshToken()

    const resultsByAccount: Record<string, any[]> = {}

    for (const conta of CONTAS) {
      const rawId = process.env[conta.envKey] || ''
      if (!rawId) continue
      const customerId = rawId.replace(/-/g, '')
      try {
        const customer = client.Customer({
          customer_id: customerId,
          login_customer_id: mccId,
          refresh_token: refreshToken,
        })
        const rows = await customer.query(`
          SELECT campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
          FROM campaign
          WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        `)
        resultsByAccount[conta.nome] = rows
      } catch {
        resultsByAccount[conta.nome] = []
      }
    }

    // Métricas por site
    // BN: todas as campanhas
    // Eros: todas exceto manipulação
    // Farma: todas exceto manipulação
    const porSite: Record<string, { spend: number; clicks: number; impressions: number; conversions: number }> = {}
    for (const conta of CONTAS) {
      const rows = resultsByAccount[conta.nome] || []
      let spend = 0, clicks = 0, impressions = 0, conversions = 0
      for (const row of rows) {
        const name: string = row.campaign?.name || ''
        if (conta.nome === 'Damatta Eros' && CAMPANHAS_MANIPULACAO_EROS.some(c => name === c)) continue
        if (conta.nome === 'Damatta Farma' && CAMPANHAS_MANIPULACAO_FARMA.some(c => name === c)) continue
        spend += Number(row.metrics?.cost_micros || 0) / 1_000_000
        clicks += Number(row.metrics?.clicks || 0)
        impressions += Number(row.metrics?.impressions || 0)
        conversions += Number(row.metrics?.conversions || 0)
      }
      porSite[conta.site] = { spend, clicks, impressions, conversions }
    }

    // Spend de manipulação da Farma (para vendedores)
    const farmaRows = resultsByAccount['Damatta Farma'] || []
    let farmaManipulacaoSpend = 0
    for (const row of farmaRows) {
      const name: string = row.campaign?.name || ''
      if (CAMPANHAS_MANIPULACAO_FARMA.some(c => name === c)) {
        farmaManipulacaoSpend += Number(row.metrics?.cost_micros || 0) / 1_000_000
      }
    }

    // spendByVendedor
    const spendByVendedor: Record<string, number> = {}

    // Farma: campanhas de manipulação → 50/50 Amanda e Gabrielly
    const farmaPorVendedor = farmaManipulacaoSpend / FARMA_VENDEDORES.length
    for (const v of FARMA_VENDEDORES) {
      spendByVendedor[v] = (spendByVendedor[v] || 0) + farmaPorVendedor
    }

    // Eros: campanhas de manipulação são excluídas do site Eros mas NÃO vão para vendedores
    // Calculamos o spend delas para incluir no total geral
    const erosRows = resultsByAccount['Damatta Eros'] || []
    let erosManipulacaoSpend = 0
    for (const row of erosRows) {
      const name: string = row.campaign?.name || ''
      if (CAMPANHAS_MANIPULACAO_EROS.some(c => name === c)) {
        erosManipulacaoSpend += Number(row.metrics?.cost_micros || 0) / 1_000_000
      }
    }

    // totalSpend inclui TODOS os gastos Google Ads (porSite + manipulação)
    const totalSpend = Object.values(porSite).reduce((s, c) => s + c.spend, 0)
      + farmaManipulacaoSpend + erosManipulacaoSpend
    const totalClicks = Object.values(porSite).reduce((s, c) => s + c.clicks, 0)
    const totalImpressions = Object.values(porSite).reduce((s, c) => s + c.impressions, 0)
    const totalConversions = Object.values(porSite).reduce((s, c) => s + c.conversions, 0)

    return NextResponse.json({
      totalSpend,
      totalClicks,
      totalImpressions,
      totalConversions,
      porSite,
      spendByVendedor,
    })
  } catch (error: any) {
    const details = error?.errors || error?.message || String(error)
    return NextResponse.json(
      { error: 'Erro ao buscar Google Ads', details },
      { status: 500 }
    )
  }
}
