'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Pencil, Check, X } from 'lucide-react'

export default function MetasPage() {
  return <Suspense><MetasContent /></Suspense>
}

const LOJAS = [
  { key: 'eros', label: 'Damatta Eros' },
  { key: 'barba-negra', label: 'Barba Negra' },
  { key: 'farma', label: 'Damatta Farma' },
]

function MetasContent() {
  const searchParams = useSearchParams()

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today
  const mes = start.slice(0, 7)

  // --- Lojas ---
  const [lojasReceita, setLojasReceita] = useState<Record<string, number>>({})
  const [metasLoja, setMetasLoja] = useState<Record<string, number>>({})
  const [loadingLojas, setLoadingLojas] = useState(true)
  const [editandoLoja, setEditandoLoja] = useState<string | null>(null)
  const [editLoja, setEditLoja] = useState('')

  // --- Vendedores ---
  const [clint, setClint] = useState<any>(null)
  const [metasVendedor, setMetasVendedor] = useState<any[]>([])
  const [loadingVendedores, setLoadingVendedores] = useState(true)
  const [editandoVendedor, setEditandoVendedor] = useState<string | null>(null)
  const [editVendedor, setEditVendedor] = useState('')
  const [editVendedorLeads, setEditVendedorLeads] = useState('')

  useEffect(() => {
    setLoadingLojas(true)
    Promise.all([
      ...LOJAS.map(l => fetch(`/api/integrations/yampi-loja?loja=${l.key}&start=${start}&end=${end}`).then(r => r.json()).catch(() => ({}))),
      fetch(`/api/metas-loja?mes=${mes}`).then(r => r.json()).catch(() => []),
    ]).then((results) => {
      const receitas: Record<string, number> = {}
      LOJAS.forEach((l, i) => {
        receitas[l.key] = results[i]?.revenue || 0
      })
      setLojasReceita(receitas)

      const metasArr: any[] = Array.isArray(results[LOJAS.length]) ? results[LOJAS.length] : []
      const metasMap: Record<string, number> = {}
      metasArr.forEach((m: any) => { metasMap[m.vendedor] = m.meta })
      setMetasLoja(metasMap)
      setLoadingLojas(false)
    })
  }, [start, end])

  useEffect(() => {
    setLoadingVendedores(true)
    Promise.all([
      fetch(`/api/integrations/clint?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/metas-vendedor?mes=${mes}`).then(r => r.json()).catch(() => []),
    ]).then(([clintData, metasData]) => {
      setClint(clintData)
      setMetasVendedor(Array.isArray(metasData) ? metasData : [])
      setLoadingVendedores(false)
    })
  }, [start, end])

  async function salvarMetaLoja(loja: string, meta: number) {
    await fetch('/api/metas-loja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loja, mes, meta }),
    })
    setMetasLoja(prev => ({ ...prev, [loja]: meta }))
    setEditandoLoja(null)
  }

  async function salvarMetaVendedor(vendedor: string, meta: number, metaLeads: number) {
    await fetch('/api/metas-vendedor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedor, mes, meta, meta_leads: metaLeads }),
    })
    setMetasVendedor(prev => {
      const exists = prev.find(m => m.vendedor === vendedor)
      if (exists) return prev.map(m => m.vendedor === vendedor ? { ...m, meta, meta_leads: metaLeads } : m)
      return [...prev, { vendedor, mes, meta, meta_leads: metaLeads }]
    })
    setEditandoVendedor(null)
  }

  const EXCLUIR_VENDEDORES = ['giulia azevedo', 'rayane - retenção', 'thiago mendonça', 'sem vendedor', 'adriane']
  const titleCase = (s: string) => s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

  const vendedores: any[] = (clint?.vendedores || [])
    .filter((v: any) => !EXCLUIR_VENDEDORES.some(e => v.name?.toLowerCase().trim().includes(e)))
    .map((v: any) => {
      const m = metasVendedor.find(m => m.vendedor === v.name)
      return { ...v, meta: m?.meta || 0, metaLeads: m?.meta_leads || 0 }
    })

  const totalLojasMeta = LOJAS.reduce((s, l) => s + (metasLoja[l.key] || 0), 0)
  const totalLojasReceita = LOJAS.reduce((s, l) => s + (lojasReceita[l.key] || 0), 0)
  const totalVendedoresMeta = vendedores.reduce((s, v) => s + v.meta, 0)
  const totalVendedoresReceita = clint?.revenue || 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Metas" lastSync={loadingLojas || loadingVendedores ? 'carregando...' : 'agora mesmo'} />

      <div className="p-6 space-y-8">

        {/* ===================== SEÇÃO LOJAS ===================== */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white font-bold text-lg">Lojas (E-commerce)</h2>
            <span className="text-zinc-500 text-sm">Yampi · {mes}</span>
          </div>

          {/* Progresso geral lojas */}
          {totalLojasMeta > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Meta Geral — Receita das Lojas</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${totalLojasReceita >= totalLojasMeta ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  {((totalLojasReceita / totalLojasMeta) * 100).toFixed(1)}% atingido
                </span>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <p className="text-2xl font-bold text-white">{formatCurrency(totalLojasReceita)}</p>
                <p className="text-zinc-500 text-sm mb-1">/ {formatCurrency(totalLojasMeta)}</p>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${totalLojasReceita >= totalLojasMeta ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((totalLojasReceita / totalLojasMeta) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Cards por loja */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {LOJAS.map(l => {
              const receita = lojasReceita[l.key] || 0
              const meta = metasLoja[l.key] || 0
              const pct = meta > 0 ? (receita / meta) * 100 : 0
              const atingiu = pct >= 100
              return (
                <div key={l.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold text-sm">{l.label}</h3>
                    {meta > 0 && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${atingiu ? 'bg-emerald-500/10 text-emerald-400' : pct >= 70 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-zinc-500 text-xs mb-0.5">Receita realizada</p>
                    <p className="text-xl font-bold text-white">{loadingLojas ? '...' : formatCurrency(receita)}</p>
                  </div>

                  {meta > 0 && (
                    <>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2">
                        <div
                          className={`h-1.5 rounded-full transition-all ${atingiu ? 'bg-emerald-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    {editandoLoja === l.key ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="number"
                          value={editLoja}
                          onChange={e => setEditLoja(e.target.value)}
                          className="w-28 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                          placeholder="Meta R$"
                          autoFocus
                        />
                        <button onClick={() => salvarMetaLoja(l.key, parseFloat(editLoja) || 0)} className="text-emerald-400 hover:text-emerald-300 p-1">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditandoLoja(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-zinc-500 text-xs">{meta > 0 ? `Meta: ${formatCurrency(meta)}` : 'Sem meta definida'}</p>
                        <button
                          onClick={() => { setEditandoLoja(l.key); setEditLoja(String(meta || '')) }}
                          className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ===================== SEÇÃO VENDEDORES ===================== */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white font-bold text-lg">Vendedores (CRM)</h2>
            <span className="text-zinc-500 text-sm">CLINT · {mes}</span>
          </div>

          {/* Progresso geral vendedores */}
          {totalVendedoresMeta > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Meta Geral — Receita dos Vendedores</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${totalVendedoresReceita >= totalVendedoresMeta ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  {((totalVendedoresReceita / totalVendedoresMeta) * 100).toFixed(1)}% atingido
                </span>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <p className="text-2xl font-bold text-white">{formatCurrency(totalVendedoresReceita)}</p>
                <p className="text-zinc-500 text-sm mb-1">/ {formatCurrency(totalVendedoresMeta)}</p>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${totalVendedoresReceita >= totalVendedoresMeta ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((totalVendedoresReceita / totalVendedoresMeta) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabela vendedores */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Vendedor', 'Receita', 'Meta R$', '% Meta', 'Leads', 'Meta Leads', '% Meta Leads', ''].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {loadingVendedores ? (
                    <tr><td colSpan={8} className="py-8 text-center text-zinc-500">Carregando...</td></tr>
                  ) : vendedores.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-zinc-500">Nenhum vendedor encontrado</td></tr>
                  ) : vendedores.map(v => {
                    const pctR = v.meta > 0 ? (v.revenue / v.meta) * 100 : 0
                    const pctL = v.metaLeads > 0 ? (v.leads / v.metaLeads) * 100 : 0
                    return (
                      <tr key={v.name} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{titleCase(v.name)}</td>
                        <td className="py-3 px-3 text-white font-semibold">{v.revenue > 0 ? formatCurrency(v.revenue) : '—'}</td>
                        <td className="py-3 px-3">
                          {editandoVendedor === v.name ? (
                            <input type="number" value={editVendedor} onChange={e => setEditVendedor(e.target.value)}
                              className="w-24 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                              placeholder="R$" autoFocus />
                          ) : (
                            <span className="text-zinc-300">{v.meta > 0 ? formatCurrency(v.meta) : <span className="text-zinc-600 italic text-xs">—</span>}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {v.meta > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${pctR >= 100 ? 'bg-emerald-500' : pctR >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pctR, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${pctR >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctR.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-3 text-zinc-300">{formatNumber(v.leads)}</td>
                        <td className="py-3 px-3">
                          {editandoVendedor === v.name ? (
                            <input type="number" value={editVendedorLeads} onChange={e => setEditVendedorLeads(e.target.value)}
                              className="w-20 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                              placeholder="Leads" />
                          ) : (
                            <span className="text-zinc-300">{v.metaLeads > 0 ? formatNumber(v.metaLeads) : <span className="text-zinc-600 italic text-xs">—</span>}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {v.metaLeads > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${pctL >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(pctL, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${pctL >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctL.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-3">
                          {editandoVendedor === v.name ? (
                            <div className="flex gap-1">
                              <button onClick={() => salvarMetaVendedor(v.name, parseFloat(editVendedor) || 0, parseInt(editVendedorLeads) || 0)} className="text-emerald-400 hover:text-emerald-300 p-1">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditandoVendedor(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditandoVendedor(v.name); setEditVendedor(String(v.meta || '')); setEditVendedorLeads(String(v.metaLeads || '')) }}
                              className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
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
    </div>
  )
}
