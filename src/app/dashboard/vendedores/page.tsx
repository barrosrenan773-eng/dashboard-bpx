'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

export default function VendedoresPage() {
  return <Suspense><VendedoresContent /></Suspense>
}

function VendedoresContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<any>(null)
  const [metas, setMetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('carregando...')

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today
  const mes = start.slice(0, 7)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/integrations/clint?start=${start}&end=${end}`).then(r => r.json()),
      fetch(`/api/metas-vendedor?mes=${mes}`).then(r => r.json()),
    ]).then(([clintData, metasData]) => {
      setData(clintData)
      setMetas(Array.isArray(metasData) ? metasData : [])
      setLastSync('agora mesmo')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [start, end])

  const vendedores: any[] = (data?.vendedores || []).map((v: any) => {
    const m = metas.find(m => m.vendedor === v.name)
    const meta = m?.meta || 0
    const metaLeads = m?.meta_leads || 0
    const pctMeta = meta > 0 ? (v.revenue / meta) * 100 : 0
    const pctMetaLeads = metaLeads > 0 ? (v.leads / metaLeads) * 100 : 0
    return { ...v, meta, metaLeads, pctMeta, pctMetaLeads }
  })

  const totalLeads = data?.totalLeads ?? 0
  const totalWon = data?.wonDeals ?? 0
  const totalRevenue = data?.revenue ?? 0
  const conversaoGeral = data?.conversionRate ?? 0
  const totalLeadsHoje = data?.totalLeadsHoje ?? 0
  const totalMeta = vendedores.reduce((s, v) => s + v.meta, 0)
  const totalMetaLeads = vendedores.reduce((s, v) => s + v.metaLeads, 0)
  const pctMetaGeral = totalMeta > 0 ? (totalRevenue / totalMeta) * 100 : 0
  const pctMetaLeadsGeral = totalMetaLeads > 0 ? (totalLeads / totalMetaLeads) * 100 : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Vendedores" lastSync={lastSync} />

      <div className="p-6 space-y-6">

        {/* KPIs gerais */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <KPICard title="Receita (CLINT)" value={loading ? '...' : formatCurrency(totalRevenue)} highlight="success" size="lg" />
          <KPICard title="Deals Ganhos" value={loading ? '...' : formatNumber(totalWon)} size="lg" />
          <KPICard title="Leads no Mês" value={loading ? '...' : formatNumber(totalLeads)} size="lg" />
          <KPICard title="Leads Hoje" value={loading ? '...' : formatNumber(totalLeadsHoje)} subtitle="criados hoje" size="lg" />
          <KPICard title="Conversão Geral" value={loading ? '...' : formatPercent(conversaoGeral)} highlight={conversaoGeral >= 15 ? 'success' : 'warning'} size="lg" />
        </div>

        {/* Cards por vendedor */}
        {loading ? (
          <div className="text-zinc-500 text-sm">Carregando dados dos vendedores...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vendedores.map((v) => {
              const atingiu = v.pctMeta >= 100
              return (
                <div key={v.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm truncate pr-2">{v.name}</h3>
                    {v.meta > 0 ? (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${atingiu ? 'bg-emerald-500/10 text-emerald-400' : v.pctMeta >= 70 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                        {v.pctMeta.toFixed(0)}% da meta
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600 shrink-0">sem meta</span>
                    )}
                  </div>

                  {/* Barras de progresso */}
                  {v.meta > 0 && (
                    <div className="mb-2">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-zinc-500 text-xs">Receita</span>
                        <span className="text-zinc-600 text-xs">{formatCurrency(v.revenue)} / {formatCurrency(v.meta)}</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${atingiu ? 'bg-emerald-500' : v.pctMeta >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(v.pctMeta, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {v.metaLeads > 0 && (() => {
                    const atingiuLeads = v.pctMetaLeads >= 100
                    return (
                      <div className="mb-3">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-zinc-500 text-xs">Leads</span>
                          <span className="text-zinc-600 text-xs">{formatNumber(v.leads)} / {formatNumber(v.metaLeads)}</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${atingiuLeads ? 'bg-emerald-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(v.pctMetaLeads, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <p className="text-zinc-500 text-xs">Leads Mês</p>
                      <p className="text-white font-semibold text-sm mt-0.5">{formatNumber(v.leads)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Leads Hoje</p>
                      <p className={`font-semibold text-sm mt-0.5 ${v.leadsHoje > 0 ? 'text-blue-400' : 'text-zinc-500'}`}>{formatNumber(v.leadsHoje)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Ganhos</p>
                      <p className="text-emerald-400 font-semibold text-sm mt-0.5">{formatNumber(v.won)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Conversão</p>
                      <p className={`font-semibold text-sm mt-0.5 ${v.conversao >= 15 ? 'text-emerald-400' : 'text-zinc-300'}`}>{formatPercent(v.conversao)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Ticket</p>
                      <p className="text-white font-semibold text-sm mt-0.5">{v.ticket > 0 ? formatCurrency(v.ticket) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Receita</p>
                      <p className="text-white font-bold text-sm mt-0.5">{v.revenue > 0 ? formatCurrency(v.revenue) : '—'}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tabela ranking */}
        {!loading && vendedores.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Ranking por Vendedor</h3>
              <div className="flex gap-2">
              {totalMeta > 0 && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${pctMetaGeral >= 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  Receita: {pctMetaGeral.toFixed(0)}% da meta
                </span>
              )}
              {totalMetaLeads > 0 && (
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${pctMetaLeadsGeral >= 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  Leads: {pctMetaLeadsGeral.toFixed(0)}% da meta
                </span>
              )}
            </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['#', 'Vendedor', 'Leads Mês', 'Hoje', 'Ganhos', 'Conversão', 'Receita', 'Meta', '% Meta', 'Ticket'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {vendedores.map((v, i) => {
                    const atingiu = v.pctMeta >= 100
                    return (
                      <tr key={v.name} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 text-zinc-500 text-xs">{i + 1}</td>
                        <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{v.name}</td>
                        <td className="py-3 px-3 text-zinc-300">{formatNumber(v.leads)}</td>
                        <td className={`py-3 px-3 font-medium ${v.leadsHoje > 0 ? 'text-blue-400' : 'text-zinc-600'}`}>{formatNumber(v.leadsHoje)}</td>
                        <td className="py-3 px-3 text-emerald-400 font-medium">{formatNumber(v.won)}</td>
                        <td className={`py-3 px-3 font-medium ${v.conversao >= 15 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                          {formatPercent(v.conversao)}
                        </td>
                        <td className="py-3 px-3 text-white font-semibold">{v.revenue > 0 ? formatCurrency(v.revenue) : '—'}</td>
                        <td className="py-3 px-3 text-zinc-400">{v.meta > 0 ? formatCurrency(v.meta) : <span className="text-zinc-600 italic text-xs">—</span>}</td>
                        <td className="py-3 px-3">
                          {v.meta > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${atingiu ? 'bg-emerald-500' : v.pctMeta >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(v.pctMeta, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${atingiu ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                {v.pctMeta.toFixed(0)}%
                              </span>
                            </div>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-3 text-zinc-300">{v.ticket > 0 ? formatCurrency(v.ticket) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
