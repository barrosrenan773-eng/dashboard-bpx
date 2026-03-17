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
  const [metaAds, setMetaAds] = useState<any>(null)
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
      fetch(`/api/integrations/meta-vendedores?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
    ]).then(([clintData, metasData, metaAdsData]) => {
      setData(clintData)
      setMetas(Array.isArray(metasData) ? metasData : [])
      setMetaAds(metaAdsData)
      setLastSync('agora mesmo')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [start, end])

  // Ritmo esperado: quanto % do período já passou
  const daysInMonth = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0).getDate()
  const dayEnd = Math.min(parseInt(end.slice(8, 10)), daysInMonth)
  const pctPeriodo = dayEnd / daysInMonth // ex: dia 16 de 31 = 0.516

  const EXCLUIR_VENDEDORES = ['giulia azevedo', 'rayane - retenção', 'thiago mendonça', 'sem vendedor', 'adriane']
  const titleCase = (s: string) => s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

  const vendedores: any[] = (data?.vendedores || [])
    .filter((v: any) => !EXCLUIR_VENDEDORES.some(e => v.name?.toLowerCase().trim().includes(e)) && v.won > 0)
    .map((v: any) => {
      const m = metas.find(m => m.vendedor === v.name)
      const meta = m?.meta || 0
      const metaLeads = m?.meta_leads || 0
      const pctMeta = meta > 0 ? (v.revenue / meta) * 100 : 0
      const pctMetaLeads = metaLeads > 0 ? (v.leads / metaLeads) * 100 : 0
      const metaProporcional = meta * pctPeriodo
      const ritmo = metaProporcional > 0 ? (v.revenue / metaProporcional) * 100 : 0
      const metaLeadsProporcional = metaLeads * pctPeriodo
      const ritmoLeads = metaLeadsProporcional > 0 ? (v.leads / metaLeadsProporcional) * 100 : 0
      const custoTrafego = metaAds?.spendByVendedor?.[v.name] || 0
      const cplMeta = custoTrafego > 0 && v.leads > 0 ? custoTrafego / v.leads : 0
      const roasMeta = custoTrafego > 0 && v.revenue > 0 ? v.revenue / custoTrafego : 0
      return { ...v, meta, metaLeads, pctMeta, pctMetaLeads, metaProporcional, ritmo, metaLeadsProporcional, ritmoLeads, custoTrafego, cplMeta, roasMeta }
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
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
          <KPICard title="Receita (CLINT)" value={loading ? '...' : formatCurrency(totalRevenue)} highlight="success" size="lg" />
          <KPICard title="Deals Ganhos" value={loading ? '...' : formatNumber(totalWon)} size="lg" />
          <KPICard title="Leads no Mês" value={loading ? '...' : formatNumber(totalLeads)} size="lg" />
          <KPICard title="Leads Hoje" value={loading ? '...' : formatNumber(totalLeadsHoje)} subtitle="criados hoje" size="lg" />
          <KPICard title="Conversão Geral" value={loading ? '...' : formatPercent(conversaoGeral)} highlight={conversaoGeral >= 15 ? 'success' : 'warning'} size="lg" />
          <KPICard title="Gasto Mídia (Vendedores)" value={loading || !metaAds ? '...' : formatCurrency(Object.values(metaAds?.spendByVendedor || {}).reduce((s: number, v) => s + (v as number), 0))} highlight="warning" size="lg" />
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
                    <h3 className="text-white font-semibold text-sm truncate pr-2">{titleCase(v.name)}</h3>
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
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 relative">
                        <div
                          className={`h-1.5 rounded-full transition-all ${atingiu ? 'bg-emerald-500' : v.pctMeta >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(v.pctMeta, 100)}%` }}
                        />
                        {/* Marcador do ritmo esperado */}
                        <div
                          className="absolute top-0 w-0.5 h-1.5 bg-zinc-400 rounded-full"
                          style={{ left: `${Math.min(pctPeriodo * 100, 100)}%` }}
                          title={`Esperado: ${formatCurrency(v.metaProporcional)}`}
                        />
                      </div>
                      {v.ritmo > 0 && (
                        <div className="flex justify-end mt-0.5">
                          <span className={`text-xs ${v.ritmo >= 100 ? 'text-emerald-400' : v.ritmo >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                            ritmo {v.ritmo.toFixed(0)}%
                          </span>
                        </div>
                      )}
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
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 relative">
                          <div
                            className={`h-1.5 rounded-full transition-all ${atingiuLeads ? 'bg-emerald-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(v.pctMetaLeads, 100)}%` }}
                          />
                          <div
                            className="absolute top-0 w-0.5 h-1.5 bg-zinc-400 rounded-full"
                            style={{ left: `${Math.min(pctPeriodo * 100, 100)}%` }}
                          />
                        </div>
                        {v.ritmoLeads > 0 && (
                          <div className="flex justify-end mt-0.5">
                            <span className={`text-xs ${v.ritmoLeads >= 100 ? 'text-emerald-400' : v.ritmoLeads >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              ritmo {v.ritmoLeads.toFixed(0)}%
                            </span>
                          </div>
                        )}
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
                    {v.custoTrafego > 0 && <>
                      <div>
                        <p className="text-zinc-500 text-xs">Custo Tráfego</p>
                        <p className="text-orange-400 font-semibold text-sm mt-0.5">{formatCurrency(v.custoTrafego)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">CPL</p>
                        <p className="text-zinc-300 font-semibold text-sm mt-0.5">{formatCurrency(v.cplMeta)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">ROAS</p>
                        <p className={`font-semibold text-sm mt-0.5 ${v.roasMeta >= 3 ? 'text-emerald-400' : v.roasMeta >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>{v.roasMeta.toFixed(1)}x</p>
                      </div>
                    </>}
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
                    {['#', 'Vendedor', 'Leads Mês', 'Hoje', 'Ganhos', 'Conversão', 'Receita', 'Meta', '% Meta', 'Ritmo', 'Custo Tráfego', 'CPL', 'ROAS', 'Ticket'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {vendedores.map((v, i) => {
                    const atingiu = v.pctMeta >= 100
                    return (
                      <tr key={v.name} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 text-zinc-500 text-xs">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </td>
                        <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{titleCase(v.name)}</td>
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
                        <td className="py-3 px-3">
                          {v.meta > 0 ? (
                            <span className={`text-xs font-semibold ${v.ritmo >= 100 ? 'text-emerald-400' : v.ritmo >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {v.ritmo.toFixed(0)}%
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-3 text-orange-400">{v.custoTrafego > 0 ? formatCurrency(v.custoTrafego) : <span className="text-zinc-600">—</span>}</td>
                        <td className="py-3 px-3 text-zinc-300">{v.cplMeta > 0 ? formatCurrency(v.cplMeta) : <span className="text-zinc-600">—</span>}</td>
                        <td className="py-3 px-3">
                          {v.roasMeta > 0 ? (
                            <span className={`text-xs font-semibold ${v.roasMeta >= 3 ? 'text-emerald-400' : v.roasMeta >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {v.roasMeta.toFixed(1)}x
                            </span>
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-3 px-3 text-zinc-300">{v.ticket > 0 ? formatCurrency(v.ticket) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pódio */}
            {vendedores.length >= 3 && (
              <div className="mt-8 flex items-end justify-center gap-4">
                {/* 2º lugar */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">🥈</span>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">{titleCase(vendedores[1].name.split(' ')[0])}</p>
                    <p className="text-zinc-400 text-xs">{formatCurrency(vendedores[1].revenue)}</p>
                  </div>
                  <div className="w-24 bg-zinc-600 rounded-t-lg flex items-center justify-center" style={{ height: '80px' }}>
                    <span className="text-zinc-300 font-bold text-2xl">2</span>
                  </div>
                </div>
                {/* 1º lugar */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl">🥇</span>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">{titleCase(vendedores[0].name.split(' ')[0])}</p>
                    <p className="text-emerald-400 text-xs font-semibold">{formatCurrency(vendedores[0].revenue)}</p>
                  </div>
                  <div className="w-24 bg-yellow-500/20 border border-yellow-500/30 rounded-t-lg flex items-center justify-center" style={{ height: '120px' }}>
                    <span className="text-yellow-400 font-bold text-2xl">1</span>
                  </div>
                </div>
                {/* 3º lugar */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">🥉</span>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">{titleCase(vendedores[2].name.split(' ')[0])}</p>
                    <p className="text-zinc-400 text-xs">{formatCurrency(vendedores[2].revenue)}</p>
                  </div>
                  <div className="w-24 bg-orange-900/30 rounded-t-lg flex items-center justify-center" style={{ height: '60px' }}>
                    <span className="text-orange-400 font-bold text-2xl">3</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
