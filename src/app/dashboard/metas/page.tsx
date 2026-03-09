'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'
import { Pencil, Plus, Check, X } from 'lucide-react'

export default function MetasPage() {
  const searchParams = useSearchParams()
  const [clint, setClint] = useState<any>(null)
  const [metas, setMetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editLeadsVal, setEditLeadsVal] = useState('')
  const [novoVendedor, setNovoVendedor] = useState('')
  const [novaMeta, setNovaMeta] = useState('')
  const [novaMetaLeads, setNovaMetaLeads] = useState('')
  const [adicionando, setAdicionando] = useState(false)

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
      setClint(clintData)
      setMetas(Array.isArray(metasData) ? metasData : [])
      setLoading(false)
    })
  }, [start, end])

  const vendedores: any[] = clint?.vendedores || []

  const vendedoresComMeta = vendedores.map(v => {
    const m = metas.find(m => m.vendedor === v.name)
    return { ...v, meta: m?.meta || 0, metaLeads: m?.meta_leads || 0 }
  })

  async function salvarMeta(vendedor: string, meta: number, metaLeads: number) {
    await fetch('/api/metas-vendedor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedor, mes, meta, meta_leads: metaLeads }),
    })
    setMetas(prev => {
      const exists = prev.find(m => m.vendedor === vendedor)
      if (exists) return prev.map(m => m.vendedor === vendedor ? { ...m, meta, meta_leads: metaLeads } : m)
      return [...prev, { vendedor, mes, meta, meta_leads: metaLeads }]
    })
    setEditando(null)
  }

  async function adicionarNovo() {
    if (!novoVendedor || !novaMeta) return
    await salvarMeta(
      novoVendedor,
      parseFloat(novaMeta.replace(',', '.')),
      parseInt(novaMetaLeads) || 0
    )
    setNovoVendedor('')
    setNovaMeta('')
    setNovaMetaLeads('')
    setAdicionando(false)
  }

  const totalMeta = vendedoresComMeta.reduce((s, v) => s + v.meta, 0)
  const totalRealizado = clint?.revenue || 0
  const totalMetaLeads = vendedoresComMeta.reduce((s, v) => s + v.metaLeads, 0)
  const totalLeads = clint?.totalLeads || 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Metas" lastSync={loading ? 'carregando...' : 'agora mesmo'} />

      <div className="p-6 space-y-6">

        {/* Cards de meta geral */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Meta de receita */}
          {totalMeta > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Meta Geral — Receita</h3>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${totalRealizado >= totalMeta ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {((totalRealizado / totalMeta) * 100).toFixed(1)}% atingido
                </span>
              </div>
              <div className="flex items-end gap-4 mb-4">
                <div>
                  <p className="text-zinc-500 text-xs">Realizado (CLINT)</p>
                  <p className="text-3xl font-bold text-white">{formatCurrency(totalRealizado)}</p>
                </div>
                <div className="text-zinc-600 text-2xl font-light mb-1">/</div>
                <div>
                  <p className="text-zinc-500 text-xs">Meta</p>
                  <p className="text-3xl font-bold text-zinc-400">{formatCurrency(totalMeta)}</p>
                </div>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${totalRealizado >= totalMeta ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((totalRealizado / totalMeta) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Meta de leads */}
          {totalMetaLeads > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Meta Geral — Leads</h3>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${totalLeads >= totalMetaLeads ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {((totalLeads / totalMetaLeads) * 100).toFixed(1)}% atingido
                </span>
              </div>
              <div className="flex items-end gap-4 mb-4">
                <div>
                  <p className="text-zinc-500 text-xs">Leads no mês</p>
                  <p className="text-3xl font-bold text-white">{formatNumber(totalLeads)}</p>
                </div>
                <div className="text-zinc-600 text-2xl font-light mb-1">/</div>
                <div>
                  <p className="text-zinc-500 text-xs">Meta</p>
                  <p className="text-3xl font-bold text-zinc-400">{formatNumber(totalMetaLeads)}</p>
                </div>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${totalLeads >= totalMetaLeads ? 'bg-emerald-500' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min((totalLeads / totalMetaLeads) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tabela de metas por vendedor */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Metas por Vendedor — {mes}</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Clique no lápis para editar as metas de receita e leads</p>
            </div>
            <button
              onClick={() => setAdicionando(true)}
              className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Vendedor', 'Leads', 'Ganhos', 'Conversão', 'Receita', 'Meta R$', '% Meta R$', 'Leads Mês', 'Meta Leads', '% Meta Leads', ''].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr><td colSpan={11} className="py-8 text-center text-zinc-500">Carregando...</td></tr>
                ) : vendedoresComMeta.length === 0 ? (
                  <tr><td colSpan={11} className="py-8 text-center text-zinc-500">Nenhum vendedor encontrado</td></tr>
                ) : (
                  vendedoresComMeta.map((v) => {
                    const pctReceita = v.meta > 0 ? (v.revenue / v.meta) * 100 : 0
                    const pctLeads = v.metaLeads > 0 ? (v.leads / v.metaLeads) * 100 : 0
                    const atingiuReceita = pctReceita >= 100
                    const atingiuLeads = pctLeads >= 100
                    return (
                      <tr key={v.name} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{v.name}</td>
                        <td className="py-3 px-3 text-zinc-300">{v.leads}</td>
                        <td className="py-3 px-3 text-emerald-400 font-medium">{v.won}</td>
                        <td className="py-3 px-3 text-zinc-300">{formatPercent(v.conversao)}</td>
                        <td className="py-3 px-3 text-white font-semibold">{v.revenue > 0 ? formatCurrency(v.revenue) : '—'}</td>
                        <td className="py-3 px-3">
                          {editando === v.name ? (
                            <input
                              type="number"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              className="w-24 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                              placeholder="R$"
                              autoFocus
                            />
                          ) : (
                            <span className="text-zinc-300">{v.meta > 0 ? formatCurrency(v.meta) : <span className="text-zinc-600 italic text-xs">—</span>}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {v.meta > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${atingiuReceita ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pctReceita, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${atingiuReceita ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctReceita.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-3 text-zinc-300">{formatNumber(v.leads)}</td>
                        <td className="py-3 px-3">
                          {editando === v.name ? (
                            <input
                              type="number"
                              value={editLeadsVal}
                              onChange={e => setEditLeadsVal(e.target.value)}
                              className="w-20 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                              placeholder="Leads"
                            />
                          ) : (
                            <span className="text-zinc-300">{v.metaLeads > 0 ? formatNumber(v.metaLeads) : <span className="text-zinc-600 italic text-xs">—</span>}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {v.metaLeads > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${atingiuLeads ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(pctLeads, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${atingiuLeads ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctLeads.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-3">
                          {editando === v.name ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => salvarMeta(v.name, parseFloat(editVal) || 0, parseInt(editLeadsVal) || 0)}
                                className="text-emerald-400 hover:text-emerald-300 p-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditando(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditando(v.name); setEditVal(String(v.meta || '')); setEditLeadsVal(String(v.metaLeads || '')) }}
                              className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}

                {/* Linha para adicionar novo */}
                {adicionando && (
                  <tr className="bg-zinc-800/30">
                    <td className="py-3 px-3" colSpan={4}>
                      <input
                        type="text"
                        value={novoVendedor}
                        onChange={e => setNovoVendedor(e.target.value)}
                        placeholder="Nome do vendedor"
                        className="w-full bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-3" colSpan={2}>
                      <input
                        type="number"
                        value={novaMeta}
                        onChange={e => setNovaMeta(e.target.value)}
                        placeholder="Meta R$"
                        className="w-full bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-3" colSpan={2}>
                      <input
                        type="number"
                        value={novaMetaLeads}
                        onChange={e => setNovaMetaLeads(e.target.value)}
                        placeholder="Meta Leads"
                        className="w-full bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-purple-500"
                      />
                    </td>
                    <td className="py-3 px-3" colSpan={3}>
                      <div className="flex gap-2">
                        <button onClick={adicionarNovo} className="text-emerald-400 hover:text-emerald-300 p-1">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setAdicionando(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
