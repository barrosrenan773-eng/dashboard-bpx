import { NextResponse } from 'next/server'
import axios from 'axios'

export const maxDuration = 30

const VENDEDORES_ACCOUNT = '1405263997911642'
const USD_BRL_FALLBACK = 5.80

async function getUsdBrl(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await res.json()
    return data.rates?.BRL || USD_BRL_FALLBACK
  } catch {
    return USD_BRL_FALLBACK
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  const token = process.env.META_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 400 })

  try {
    const usdBrl = await getUsdBrl()

    // Busca insights por campanha da conta vendedores
    const res = await axios.get(
      `https://graph.facebook.com/v19.0/act_${VENDEDORES_ACCOUNT}/campaigns`,
      {
        params: {
          access_token: token,
          fields: `name,insights.time_range({"since":"${startDate}","until":"${endDate}"}){spend}`,
          limit: 100,
        },
      }
    )

    const campaigns: any[] = res.data.data || []
    const spendByVendedor: Record<string, number> = {}

    for (const c of campaigns) {
      const spend = parseFloat(c.insights?.data?.[0]?.spend || 0) * usdBrl
      if (spend === 0) continue

      // Extrai nomes entre colchetes ex: "[MACAPÁ] [ARTHUR] [DISFUNÇÃO]" → ["MACAPÁ","ARTHUR","DISFUNÇÃO"]
      const tags = (c.name.match(/\[([^\]]+)\]/g) || []).map((t: string) => t.slice(1, -1).toUpperCase())

      // Lista de primeiros nomes dos vendedores conhecidos
      const VENDEDOR_TAGS: Record<string, string> = {
        'GABRIELLY': 'Gabrielly Oliveira',
        'AMANDA': 'Amanda Oliveira',
        'TAYNARA': 'Taynara Silva',
        'ARTHUR': 'Arthur BPX',
        'ALINE': 'Aline  Rodrigues ',
        'DANIELE': 'Daniele  santos ',
        'MAIARA': 'Maiara damatta',
        'JUNIOR': 'Junior  Silva',
        'RAYANE': 'Rayane  damatta ',
        'PAMELLA': 'Pamella BPX',
        'ADRIANE': 'Adriane  Souza ',
      }

      for (const tag of tags) {
        if (VENDEDOR_TAGS[tag]) {
          const name = VENDEDOR_TAGS[tag]
          spendByVendedor[name] = (spendByVendedor[name] || 0) + spend
          break
        }
      }
    }

    const totalSpend = Object.values(spendByVendedor).reduce((s, v) => s + v, 0)
    return NextResponse.json({ spendByVendedor, totalSpend, usdBrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
