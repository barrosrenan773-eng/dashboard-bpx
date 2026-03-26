'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'

export default function CanaisPage() {
  return <Suspense><CanaisContent /></Suspense>
}

const LOJAS = [
  { key: 'eros', label: 'BPX Eros', cor: 'emerald', href: '/dashboard/canais/eros' },
  { key: 'barba-negra', label: 'Barba Negra', cor: 'blue', href: '/dashboard/canais/barba-negra' },
  { key: 'farma', label: 'BPX Farma', cor: 'purple', href: '/dashboard/canais/farma' },
]

const COR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
}

function CanaisContent() {
  const searchParams = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today

  const [lojasData, setLojasData] = useState<Record<string, any>>({})
  const [googleAds, setGoogleAds] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Mapa: key da loja → nome da conta Google Ads (porSite)
  const GOOGLE_ADS_SITE_MAP: Record<string, string> = {
    'eros': 'BPX Eros',
    'barba-negra': 'Barba Negra',
    'farma': 'BPX Farma',
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      ...LOJAS.map(l =>
        fetch(`/api/integrations/yampi-loja?loja=${l.key}&start=${start}&end=${end}`)
          .then(r => r.json()).catch(() => ({}))
      ),
      fetch(`/api/integrations/google-ads?start=${start}&end=${end}`)
        .then(r => r.json()).catch(() => null),
    ]).then(results => {
      const data: Record<string, any> = {}
      LOJAS.forEach((l, i) => { data[l.key] = results[i] })
      setLojasData(data)
      setGoogleAds(results[LOJAS.length])
      setLoading(false)
    })
  }, [start, end])

  const totalReceita = LOJAS.reduce((s, l) => s + (lojasData[l.key]?.revenue || 0), 0)
  const totalPedidos = LOJAS.reduce((s, l) => s + (lojasData[l.key]?.orders || 0), 0)
  const totalGoogleAds = googleAds?.totalSpend || 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Sites" lastSync={loading ? 'carregando...' : 'agora mesmo'} />

      <div className="p-6 space-y-6">

        {/* KPIs resumo */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard title="Receita Total (Lojas)" value={loading ? '...' : formatCurrency(totalReceita)} highlight="success" size="lg" />
          <KPICard title="Pedidos Total" value={loading ? '...' : formatNumber(totalPedidos)} size="lg" />
          <KPICard title="Investimento Google Ads" value={loading ? '...' : formatCurrency(totalGoogleAds)} highlight="warning" size="lg" />
          <KPICard title="Ticket Médio Geral" value={loading ? '...' : formatCurrency(totalPedidos > 0 ? totalReceita / totalPedidos : 0)} size="lg" />
        </div>

        {/* Cards por loja */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {LOJAS.map(l => {
            const d = lojasData[l.key] || {}
            const revenue = d.revenue || 0
            const orders = d.orders || 0
            const avgTicket = d.avgTicket || 0
            const siteName = GOOGLE_ADS_SITE_MAP[l.key]
            const gadsSpend = googleAds?.porSite?.[siteName]?.spend || 0

            return (
              <Link key={l.key} href={l.href} className="block">
                <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-5 h-full transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${COR_MAP[l.cor]}`} />
                      <h3 className="text-white font-semibold text-sm">{l.label}</h3>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-zinc-500" />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-zinc-500 text-xs">Receita no período</p>
                      <p className="text-white font-bold text-xl mt-0.5">{loading ? '...' : formatCurrency(revenue)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-zinc-500 text-xs">Pedidos</p>
                        <p className="text-zinc-200 font-semibold text-sm mt-0.5">{loading ? '...' : formatNumber(orders)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Ticket Médio</p>
                        <p className="text-zinc-200 font-semibold text-sm mt-0.5">{loading ? '...' : (avgTicket > 0 ? formatCurrency(avgTicket) : '—')}</p>
                      </div>
                    </div>
                    {gadsSpend > 0 && (
                      <div className="pt-2 border-t border-zinc-800">
                        <p className="text-zinc-500 text-xs">Google Ads</p>
                        <p className="text-amber-400 font-semibold text-sm mt-0.5">{formatCurrency(gadsSpend)}</p>
                      </div>
                    )}
                  </div>

                  <p className="text-zinc-600 text-xs mt-4">Ver detalhes →</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Tabela comparativa */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Comparativo de Lojas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Loja', 'Receita', 'Google Ads', 'Pedidos', 'Ticket Médio', '% do Total'].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-zinc-500">Carregando...</td></tr>
                ) : LOJAS.map(l => {
                  const d = lojasData[l.key] || {}
                  const revenue = d.revenue || 0
                  const orders = d.orders || 0
                  const avgTicket = d.avgTicket || 0
                  const pct = totalReceita > 0 ? (revenue / totalReceita) * 100 : 0
                  const siteName = GOOGLE_ADS_SITE_MAP[l.key]
                  const gadsSpend = googleAds?.porSite?.[siteName]?.spend || 0
                  return (
                    <tr key={l.key} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${COR_MAP[l.cor]}`} />
                          <span className="text-white font-medium">{l.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(revenue)}</td>
                      <td className="py-3 px-3 text-amber-400">{gadsSpend > 0 ? formatCurrency(gadsSpend) : <span className="text-zinc-600">—</span>}</td>
                      <td className="py-3 px-3 text-zinc-300">{formatNumber(orders)}</td>
                      <td className="py-3 px-3 text-zinc-300">{avgTicket > 0 ? formatCurrency(avgTicket) : '—'}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-zinc-800 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${COR_MAP[l.cor]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-zinc-400 text-xs">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
