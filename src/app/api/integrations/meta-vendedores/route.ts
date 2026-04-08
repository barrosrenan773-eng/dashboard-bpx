import { NextResponse } from 'next/server'
import axios from 'axios'

export const maxDuration = 30

const META_ACCOUNT = '451679706373080'
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

  const token = (process.env.META_ADS_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '').trim()
  if (!token) return NextResponse.json({ error: 'META_ADS_ACCESS_TOKEN não configurado' }, { status: 400 })

  try {
    const usdBrl = await getUsdBrl()

    // Busca spend total da conta via insights agregados
    const res = await axios.get(
      `https://graph.facebook.com/v19.0/act_${META_ACCOUNT}/insights`,
      {
        params: {
          access_token: token,
          fields: 'spend,account_currency',
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          level: 'account',
        },
      }
    )

    const row = res.data.data?.[0]
    const spendRaw = parseFloat(row?.spend || '0')
    const currency = row?.account_currency || 'USD'
    // Só converte se a conta estiver em USD; contas BRL já vêm no valor correto
    const totalSpend = currency === 'BRL' ? spendRaw : spendRaw * usdBrl

    // Retorna no mesmo formato esperado pelo frontend (spendByVendedor vazio = sem breakdown)
    return NextResponse.json({ spendByVendedor: {}, totalSpend, usdBrl })
  } catch (error: any) {
    const detail = error.response?.data ?? error.message
    console.error('[meta-vendedores]', detail)
    return NextResponse.json({ error: error.message, detail }, { status: 500 })
  }
}
