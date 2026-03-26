'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default function ProdutosPage() {
  return <Suspense><ProdutosContent /></Suspense>
}

function ProdutosContent() {
  const searchParams = useSearchParams()
  const [yampiProdutos, setYampiProdutos] = useState<any[]>([])
  const [clintProdutos, setClintProdutos] = useState<any[]>([])
  const [blingData, setBlingData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('carregando...')
  const [aba, setAba] = useState<'yampi' | 'clint' | 'bling'>('bling')

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/integrations/yampi-produtos?start=${start}&end=${end}`).then(r => r.json()),
      fetch(`/api/integrations/clint-produtos?start=${start}&end=${end}`).then(r => r.json()),
      fetch(`/api/integrations/bling-produtos?start=${start}&end=${end}`).then(r => r.json()),
    ]).then(([yampi, clint, bling]) => {
      setYampiProdutos(yampi.produtos || [])
      setClintProdutos(clint.produtos || [])
      setBlingData(bling.error ? null : bling)
      setLastSync('agora mesmo')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [start, end])

  const produtos = aba === 'yampi' ? yampiProdutos : aba === 'clint' ? clintProdutos : (blingData?.produtos || [])

  const totalReceita = aba === 'bling' ? (blingData?.totalReceita || 0) : produtos.reduce((s: number, p: any) => s + p.revenue, 0)
  const totalVendas = produtos.reduce((s: number, p: any) => s + (aba === 'yampi' ? p.orders : aba === 'clint' ? p.deals : p.orders), 0)
  const totalItens = aba === 'yampi' ? yampiProdutos.reduce((s: number, p: any) => s + p.quantity, 0) : null
  const ticketMedio = totalVendas > 0 ? totalReceita / totalVendas : 0

  const top3 = [...produtos].slice(0, 3)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Produtos" lastSync={lastSync} />

      <div className="p-6 space-y-6">

        {/* Abas */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setAba('bling')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === 'bling' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
            Lucro (Bling ERP)
          </button>
          <button onClick={() => setAba('yampi')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === 'yampi' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
            E-commerce (Yampi)
          </button>
          <button onClick={() => setAba('clint')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === 'clint' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
            CRM (CLINT)
          </button>
        </div>

        {/* KPIs Bling */}
        {aba === 'bling' && (
          <>
            {!blingData && !loading && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-yellow-400 text-sm">
                Bling não autorizado ainda.{' '}
                <a href="/api/auth/bling/authorize" className="underline font-medium">Clique aqui para autorizar</a>
              </div>
            )}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <KPICard title="Receita Total" value={loading ? '...' : formatCurrency(blingData?.totalReceita || 0)} highlight="success" size="lg" />
              <KPICard title="Custo Total" value={loading ? '...' : formatCurrency(blingData?.totalCusto || 0)} size="lg" />
              <KPICard title="Lucro Bruto" value={loading ? '...' : formatCurrency(blingData?.totalLucro || 0)} highlight={(blingData?.totalLucro || 0) >= 0 ? 'success' : 'danger'} size="lg" />
              <KPICard title="Margem Bruta" value={loading ? '...' : `${(blingData?.margemGeral || 0).toFixed(1)}%`} highlight={(blingData?.margemGeral || 0) >= 30 ? 'success' : 'warning'} size="lg" />
            </div>
          </>
        )}

        {/* KPIs Yampi/CLINT */}
        {aba !== 'bling' && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KPICard title="Receita Total" value={loading ? '...' : formatCurrency(totalReceita)} highlight="success" size="lg" />
            <KPICard title={aba === 'yampi' ? 'Pedidos' : 'Deals Ganhos'} value={loading ? '...' : formatNumber(totalVendas)} size="lg" />
            <KPICard title="Ticket Médio" value={loading ? '...' : formatCurrency(ticketMedio)} size="lg" />
            {aba === 'yampi'
              ? <KPICard title="Itens Vendidos" value={loading ? '...' : formatNumber(totalItens ?? 0)} size="lg" />
              : <KPICard title="Produtos Distintos" value={loading ? '...' : formatNumber(clintProdutos.length)} size="lg" />
            }
          </div>
        )}

        {/* Top 3 */}
        {!loading && top3.length > 0 && (
          <div>
            <h3 className="text-white font-semibold mb-3">Top 3 por Receita</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((p, i) => (
                <div key={p.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <h4 className="text-white font-medium text-sm truncate">{p.name}</h4>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(p.revenue)}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {aba === 'bling' ? (
                      <>
                        <div>
                          <p className="text-zinc-500 text-xs">Custo</p>
                          <p className="text-white font-medium text-sm">{formatCurrency(p.cost)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Lucro</p>
                          <p className={`font-medium text-sm ${p.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(p.lucro)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Margem</p>
                          <p className={`font-medium text-sm ${p.margem >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{p.margem.toFixed(1)}%</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-zinc-500 text-xs">{aba === 'yampi' ? 'Pedidos' : 'Deals'}</p>
                          <p className="text-white font-medium text-sm">{aba === 'yampi' ? p.orders : p.deals}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Ticket</p>
                          <p className="text-white font-medium text-sm">{formatCurrency(p.avgTicket)}</p>
                        </div>
                        {aba === 'yampi' ? (
                          <div>
                            <p className="text-zinc-500 text-xs">Qtd</p>
                            <p className="text-white font-medium text-sm">{p.quantity}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-zinc-500 text-xs">Vendedores</p>
                            <p className="text-white font-medium text-sm">{p.vendedores}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">
            {aba === 'bling' ? 'Análise de Lucro por Produto (Bling ERP)' : aba === 'yampi' ? 'Produtos — E-commerce (Yampi)' : 'Serviços/Produtos — CRM (CLINT)'}
          </h3>
          {loading ? (
            <p className="text-zinc-500 text-sm py-4">Carregando...</p>
          ) : produtos.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4">Nenhum dado encontrado para este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {aba === 'bling'
                      ? ['#', 'Produto', 'Qtd', 'Receita', 'Custo', 'Lucro Bruto', 'Margem'].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                        ))
                      : aba === 'yampi'
                      ? ['#', 'Produto', 'Pedidos', 'Qtd Vendida', 'Receita', 'Ticket Médio'].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                        ))
                      : ['#', 'Produto / Serviço', 'Deals', 'Receita', 'Ticket Médio', 'Vendedores'].map(h => (
                          <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                        ))
                    }
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {produtos.map((p: any, i: number) => (
                    <tr key={p.name + i} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 text-zinc-500 text-xs">{i + 1}</td>
                      <td className="py-3 px-3 text-white font-medium max-w-[200px] truncate">{p.name}</td>
                      {aba === 'bling' ? (
                        <>
                          <td className="py-3 px-3 text-zinc-300">{formatNumber(p.quantity)}</td>
                          <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(p.revenue)}</td>
                          <td className="py-3 px-3 text-zinc-400">{p.cost > 0 ? formatCurrency(p.cost) : <span className="text-zinc-600 italic text-xs">—</span>}</td>
                          <td className={`py-3 px-3 font-semibold ${p.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.cost > 0 ? formatCurrency(p.lucro) : <span className="text-zinc-600 italic text-xs">—</span>}</td>
                          <td className="py-3 px-3">
                            {p.cost > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-12 bg-zinc-800 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full ${p.margem >= 30 ? 'bg-emerald-500' : p.margem >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(p.margem, 100)}%` }} />
                                </div>
                                <span className={`text-xs font-medium ${p.margem >= 30 ? 'text-emerald-400' : p.margem >= 10 ? 'text-amber-400' : 'text-red-400'}`}>{p.margem.toFixed(1)}%</span>
                              </div>
                            ) : <span className="text-zinc-600 italic text-xs">sem custo</span>}
                          </td>
                        </>
                      ) : aba === 'yampi' ? (
                        <>
                          <td className="py-3 px-3 text-zinc-300">{formatNumber(p.orders)}</td>
                          <td className="py-3 px-3 text-zinc-300">{formatNumber(p.quantity)}</td>
                          <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(p.revenue)}</td>
                          <td className="py-3 px-3 text-zinc-300">{formatCurrency(p.avgTicket)}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-3 text-zinc-300">{formatNumber(p.deals)}</td>
                          <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(p.revenue)}</td>
                          <td className="py-3 px-3 text-zinc-300">{formatCurrency(p.avgTicket)}</td>
                          <td className="py-3 px-3 text-zinc-300">{p.vendedores}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
