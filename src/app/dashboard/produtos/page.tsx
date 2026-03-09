'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default function ProdutosPage() {
  const searchParams = useSearchParams()
  const [yampiProdutos, setYampiProdutos] = useState<any[]>([])
  const [clintProdutos, setClintProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('carregando...')
  const [aba, setAba] = useState<'yampi' | 'clint'>('yampi')

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/integrations/yampi-produtos?start=${start}&end=${end}`).then(r => r.json()),
      fetch(`/api/integrations/clint-produtos?start=${start}&end=${end}`).then(r => r.json()),
    ]).then(([yampi, clint]) => {
      setYampiProdutos(yampi.produtos || [])
      setClintProdutos(clint.produtos || [])
      setLastSync('agora mesmo')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [start, end])

  const produtos = aba === 'yampi' ? yampiProdutos : clintProdutos

  const totalReceita = produtos.reduce((s, p) => s + p.revenue, 0)
  const totalVendas = produtos.reduce((s, p) => s + (aba === 'yampi' ? p.orders : p.deals), 0)
  const totalItens = aba === 'yampi' ? yampiProdutos.reduce((s, p) => s + p.quantity, 0) : null
  const ticketMedio = totalVendas > 0 ? totalReceita / totalVendas : 0

  const top3 = [...produtos].slice(0, 3)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Produtos" lastSync={lastSync} />

      <div className="p-6 space-y-6">

        {/* Abas Yampi / CLINT */}
        <div className="flex gap-2">
          <button
            onClick={() => setAba('yampi')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === 'yampi' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            E-commerce (Yampi)
          </button>
          <button
            onClick={() => setAba('clint')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === 'clint' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            CRM (CLINT)
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard title="Receita Total" value={loading ? '...' : formatCurrency(totalReceita)} highlight="success" size="lg" />
          <KPICard title={aba === 'yampi' ? 'Pedidos' : 'Deals Ganhos'} value={loading ? '...' : formatNumber(totalVendas)} size="lg" />
          <KPICard title="Ticket Médio" value={loading ? '...' : formatCurrency(ticketMedio)} size="lg" />
          {aba === 'yampi'
            ? <KPICard title="Itens Vendidos" value={loading ? '...' : formatNumber(totalItens ?? 0)} size="lg" />
            : <KPICard title="Produtos Distintos" value={loading ? '...' : formatNumber(clintProdutos.length)} size="lg" />
          }
        </div>

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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela completa */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">
            {aba === 'yampi' ? 'Produtos — E-commerce (Yampi)' : 'Serviços/Produtos — CRM (CLINT)'}
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
                    {aba === 'yampi'
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
                  {produtos.map((p, i) => (
                    <tr key={p.name} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 text-zinc-500 text-xs">{i + 1}</td>
                      <td className="py-3 px-3 text-white font-medium">{p.name}</td>
                      {aba === 'yampi' ? (
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
