'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { Pencil, Check, X } from 'lucide-react'

function getCurrentMes() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MetaPage() {
  const mes = getCurrentMes()

  const [clintConsultores, setClintConsultores] = useState<any[]>([])
  const [metasVendedor, setMetasVendedor] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [editMeta, setEditMeta] = useState('')
  const [editMetaLeads, setEditMetaLeads] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/clint?mes=${mes}&noLeads=1`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/metas-vendedor?mes=${mes}`).then(r => r.json()).catch(() => []),
    ]).then(([clintData, metasData]) => {
      setClintConsultores(clintData?.consultores ?? [])
      setMetasVendedor(Array.isArray(metasData) ? metasData : [])
      setLoading(false)
    })
  }, [mes])

  async function salvarMeta(nome: string, meta: number, metaLeads: number) {
    await fetch('/api/metas-vendedor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedor: nome, mes, meta, meta_leads: metaLeads }),
    })
    setMetasVendedor(prev => {
      const exists = prev.find(m => m.vendedor === nome)
      if (exists) return prev.map(m => m.vendedor === nome ? { ...m, meta, meta_leads: metaLeads } : m)
      return [...prev, { vendedor: nome, mes, meta, meta_leads: metaLeads }]
    })
    setEditando(null)
  }

  function getMeta(nome: string) {
    return metasVendedor.find(m => m.vendedor === nome) ?? { meta: 0, meta_leads: 0 }
  }

  const vendedores = clintConsultores.map(c => {
    const { meta, meta_leads } = getMeta(c.nome)
    return { nome: c.nome, receita: c.receita, deals: c.deals, meta, metaLeads: meta_leads }
  })

  const totalReceita = vendedores.reduce((s, v) => s + v.receita, 0)
  const totalMeta = vendedores.reduce((s, v) => s + v.meta, 0)
  const pctGeral = totalMeta > 0 ? Math.min((totalReceita / totalMeta) * 100, 100) : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Consultores" lastSync={loading ? 'carregando...' : 'agora mesmo'} />

      <div className="p-6 space-y-6">

        {/* Progresso geral */}
        {totalMeta > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Meta Geral — Receita dos Consultores</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${pctGeral >= 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                {pctGeral.toFixed(1)}% atingido
              </span>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <p className="text-2xl font-bold text-white">{formatCurrency(totalReceita)}</p>
              <p className="text-zinc-500 text-sm mb-1">/ {formatCurrency(totalMeta)}</p>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${pctGeral >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${pctGeral}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabela consultores */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Consultores</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Consultor', 'Receita', 'Meta R$', '% Meta', 'Ganhos', 'Meta Leads', '% Leads', ''].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-500">Carregando...</td></tr>
                ) : vendedores.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-500">Nenhum consultor encontrado</td></tr>
                ) : vendedores.map(v => {
                  const isEdit = editando === v.nome
                  const metaAtiva = isEdit ? (parseFloat(editMeta) || 0) : v.meta
                  const metaLeadsAtiva = isEdit ? (parseInt(editMetaLeads) || 0) : v.metaLeads
                  const pctR = metaAtiva > 0 ? (v.receita / metaAtiva) * 100 : 0
                  const pctL = metaLeadsAtiva > 0 ? (v.deals / metaLeadsAtiva) * 100 : 0
                  return (
                    <tr key={v.nome} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{v.nome}</td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(v.receita)}</td>
                      <td className="py-3 px-3">
                        {isEdit ? (
                          <input type="number" value={editMeta} onChange={e => setEditMeta(e.target.value)}
                            className="w-24 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                            placeholder="R$" autoFocus />
                        ) : (
                          <span className="text-zinc-300">{v.meta > 0 ? formatCurrency(v.meta) : <span className="text-zinc-600 italic text-xs">—</span>}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {metaAtiva > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${pctR >= 100 ? 'bg-emerald-500' : pctR >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pctR, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${pctR >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctR.toFixed(0)}%</span>
                          </div>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-3 text-white font-semibold">{v.deals}</td>
                      <td className="py-3 px-3">
                        {isEdit ? (
                          <input type="number" value={editMetaLeads} onChange={e => setEditMetaLeads(e.target.value)}
                            className="w-20 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                            placeholder="Leads" />
                        ) : (
                          <span className="text-zinc-300">{v.metaLeads > 0 ? v.metaLeads : <span className="text-zinc-600 italic text-xs">—</span>}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {metaLeadsAtiva > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${pctL >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(pctL, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${pctL >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctL.toFixed(0)}%</span>
                          </div>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {isEdit ? (
                          <div className="flex gap-1">
                            <button onClick={() => salvarMeta(v.nome, parseFloat(editMeta) || 0, parseInt(editMetaLeads) || 0)} className="text-emerald-400 hover:text-emerald-300 p-1">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditando(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditando(v.nome); setEditMeta(String(v.meta || '')); setEditMetaLeads(String(v.metaLeads || '')) }}
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
  )
}
