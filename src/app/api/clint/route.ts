export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getConsultores } from '@/lib/clint'

const BASE = 'https://api.clint.digital/v1'

export async function GET(req: NextRequest) {
  const token = process.env.CLINT_API_TOKEN || process.env.CLINT_API_KEY
  if (!token) return NextResponse.json({ error: 'CLINT_API_TOKEN não configurado' }, { status: 500 })

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const mes = req.nextUrl.searchParams.get('mes') ?? (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const [y, m] = mes.split('-')
  const prefix = `${y}-${m.padStart(2, '0')}`

  const startDate = req.nextUrl.searchParams.get('start') || `${prefix}-01`
  const endDate = req.nextUrl.searchParams.get('end') || today
  const noLeads = req.nextUrl.searchParams.get('noLeads') === '1'

  if (req.nextUrl.searchParams.get('debug') === '1') {
    const res = await fetch(`${BASE}/deals?limit=2&status=WON&page=1`, {
      headers: { 'api-token': token }, cache: 'no-store',
    })
    const json = await res.json()
    return NextResponse.json(json)
  }

  try {
    const result = await getConsultores(token, startDate, endDate, prefix, noLeads)
    const taxaConversao = result.totalLeads > 0 ? (result.totalDeals / result.totalLeads) * 100 : 0

    return NextResponse.json({
      mes,
      receita: result.receita,
      totalDeals: result.totalDeals,
      totalLeads: result.totalLeads,
      leadsHoje: result.leadsHoje,
      taxaConversao,
      consultores: result.consultores,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
