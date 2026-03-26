'use client'

import { useEffect, useState, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown, DollarSign, Percent, Upload, FileText, AlertCircle } from 'lucide-react'

type OFXTransaction = {
  fitid: string
  tipo: string
  data: string
  valor: number
  descricao: string
  mes: string
}

type OFXCategoria = 'ignorar' | 'fixa' | 'variavel' | 'pix' | 'pessoal'

type Despesa = {
  id: number
  descricao: string
  categoria: 'fixa' | 'variavel' | 'pix' | 'pessoal'
  valor: number
  mes: string
  created_at: string
}

type Contrato = {
  id: number
  taxa: number
}

type AddingState = {
  categoria: string
  descricao: string
  valor: string
} | null

type EditingState = {
  id: number
  descricao: string
  valor: string
} | null

function getCurrentMes(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function addMonth(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${months[m - 1]} ${y}`
}

const CATEGORIAS = [
  { key: 'fixa', label: 'Despesas Fixas' },
  { key: 'variavel', label: 'Despesas Variáveis' },
  { key: 'pix', label: 'Tarifas Pix' },
  { key: 'pessoal', label: 'Despesas com Pessoal' },
] as const

export default function FinanceiroPage() {
  const [mes, setMes] = useState(getCurrentMes)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [receita, setReceita] = useState(0)
  const [metaAdsSpend, setMetaAdsSpend] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<AddingState>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const [saving, setSaving] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  function toggleCat(key: string) {
    setExpandedCats(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  // OFX reconciliation state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ofxTxs, setOfxTxs] = useState<OFXTransaction[]>([])
  const [ofxCats, setOfxCats] = useState<Record<string, OFXCategoria>>({})
  const [ofxDescricoes, setOfxDescricoes] = useState<Record<string, string>>({})
  const [ofxLoading, setOfxLoading] = useState(false)
  const [ofxError, setOfxError] = useState('')
  const [ofxConciliando, setOfxConciliando] = useState(false)
  const [ofxDone, setOfxDone] = useState(0)

  async function loadDespesas(m: string) {
    const r = await fetch(`/api/despesas?mes=${m}`)
    const data = await r.json()
    setDespesas(Array.isArray(data) ? data : [])
  }

  async function loadContratos() {
    const r = await fetch('/api/contratos')
    const data: Contrato[] = await r.json()
    const total = Array.isArray(data) ? data.reduce((s, c) => s + (c.taxa ?? 0), 0) : 0
    setReceita(total)
  }

  async function loadMetaAds(m: string) {
    try {
      const r = await fetch(`/api/meta-ads?mes=${m}`)
      const data = await r.json()
      setMetaAdsSpend(data.error ? null : (data.spend ?? null))
    } catch {
      setMetaAdsSpend(null)
    }
  }

  async function load(m: string) {
    setLoading(true)
    await Promise.all([loadDespesas(m), loadContratos(), loadMetaAds(m)])
    setLoading(false)
  }

  useEffect(() => { load(mes) }, [mes])

  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0) + (metaAdsSpend ?? 0)
  const lucro = receita - totalDespesas
  const margem = receita > 0 ? (lucro / receita) * 100 : 0
  const isPositive = lucro >= 0

  async function handleAdd(categoria: string) {
    if (!adding || saving) return
    if (!adding.descricao.trim()) return
    setSaving(true)
    const body = {
      descricao: adding.descricao,
      categoria,
      valor: parseFloat(adding.valor) || 0,
      mes,
    }
    await fetch('/api/despesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    setAdding(null)
    loadDespesas(mes)
  }

  async function handleEdit() {
    if (!editing || saving) return
    setSaving(true)
    await fetch('/api/despesas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id,
        descricao: editing.descricao,
        valor: parseFloat(editing.valor) || 0,
      }),
    })
    setSaving(false)
    setEditing(null)
    loadDespesas(mes)
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta despesa?')) return
    await fetch(`/api/despesas?id=${id}`, { method: 'DELETE' })
    loadDespesas(mes)
  }

  async function handleOFXUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOfxLoading(true)
    setOfxError('')
    setOfxTxs([])
    setOfxCats({})
    setOfxDescricoes({})
    setOfxDone(0)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/ofx', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) { setOfxError(json.error); setOfxLoading(false); return }
      const txs: OFXTransaction[] = json.transactions ?? []
      // Filtra pelo mês selecionado
      const filtered = txs.filter(t => t.mes === mes)
      setOfxTxs(filtered)
      // Default: débitos → variavel, créditos → ignorar
      const cats: Record<string, OFXCategoria> = {}
      const descs: Record<string, string> = {}
      filtered.forEach(t => {
        cats[t.fitid] = t.tipo === 'CREDIT' ? 'ignorar' : 'variavel'
        descs[t.fitid] = t.descricao
      })
      setOfxCats(cats)
      setOfxDescricoes(descs)
    } catch (err) {
      setOfxError(String(err))
    }
    setOfxLoading(false)
    // Limpa o input para permitir re-upload do mesmo arquivo
    e.target.value = ''
  }

  async function handleConciliar() {
    const toCreate = ofxTxs.filter(t => ofxCats[t.fitid] && ofxCats[t.fitid] !== 'ignorar')
    if (toCreate.length === 0) return
    setOfxConciliando(true)
    let count = 0
    for (const t of toCreate) {
      await fetch('/api/despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: ofxDescricoes[t.fitid] || t.descricao,
          categoria: ofxCats[t.fitid],
          valor: t.valor,
          mes,
        }),
      })
      count++
    }
    setOfxDone(count)
    setOfxTxs([])
    setOfxCats({})
    setOfxDescricoes({})
    setOfxConciliando(false)
    loadDespesas(mes)
  }

  const ofxParaConciliar = ofxTxs.filter(t => ofxCats[t.fitid] !== 'ignorar').length

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Financeiro" lastSync="" />

      <div className="p-6 space-y-6">

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMes(m => addMonth(m, -1))}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-base min-w-[140px] text-center">
            {formatMesLabel(mes)}
          </span>
          <button
            onClick={() => setMes(m => addMonth(m, 1))}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Receita</p>
            </div>
            <p className="text-emerald-400 font-bold text-2xl">{formatCurrency(receita)}</p>
            <p className="text-zinc-500 text-xs mt-1">Soma das taxas de contratos</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total Despesas</p>
            </div>
            <p className="text-red-400 font-bold text-2xl">{formatCurrency(totalDespesas)}</p>
            <p className="text-zinc-500 text-xs mt-1">Mês de {formatMesLabel(mes)}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`w-4 h-4 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Lucro Líquido</p>
            </div>
            <p className={`font-bold text-2xl ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(lucro)}
            </p>
            <p className="text-zinc-500 text-xs mt-1">Receita menos despesas</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Percent className={`w-4 h-4 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Margem</p>
            </div>
            <p className={`font-bold text-2xl ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {margem.toFixed(1).replace('.', ',')}%
            </p>
            <p className="text-zinc-500 text-xs mt-1">Lucro / Receita</p>
          </div>
        </div>

        {/* DRE */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-white font-semibold text-base">DRE — Demonstrativo de Resultado</h3>
            <p className="text-zinc-500 text-xs mt-0.5">{formatMesLabel(mes)}</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Carregando...</div>
          ) : (
            <div className="p-6 space-y-6">

              {/* RECEITAS */}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Receitas</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-300 text-sm">Taxas de Contratos</span>
                    <span className="text-white font-medium text-sm">{formatCurrency(receita)}</span>
                  </div>
                </div>
                <div className="border-t border-zinc-700 mt-3 pt-3 flex items-center justify-between">
                  <span className="text-zinc-400 text-sm font-semibold">Total Receitas</span>
                  <span className="text-emerald-400 font-bold text-sm">{formatCurrency(receita)}</span>
                </div>
              </div>

              {/* DESPESAS */}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Despesas</p>

                {/* Marketing automático — colapsável */}
                {metaAdsSpend !== null && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleCat('__marketing__')}
                      className="w-full flex items-center justify-between py-2 hover:bg-zinc-800/40 rounded-lg px-2 -mx-2 transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-zinc-300 text-sm font-semibold">
                        Marketing
                        <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-normal">auto</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-zinc-400 text-sm font-semibold">{formatCurrency(metaAdsSpend)}</span>
                        {expandedCats.has('__marketing__') ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                      </span>
                    </button>
                    {expandedCats.has('__marketing__') && (
                      <div className="ml-4 mt-1">
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-zinc-500 text-xs">Facebook Ads</span>
                          <span className="text-zinc-400 text-xs">{formatCurrency(metaAdsSpend)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  {CATEGORIAS.map(({ key, label }) => {
                    const items = despesas.filter(d => d.categoria === key)
                    const subtotal = items.reduce((s, d) => s + Number(d.valor), 0)
                    const isExpanded = expandedCats.has(key)
                    const isAddingThis = adding?.categoria === key

                    return (
                      <div key={key}>
                        {/* Cabeçalho clicável da categoria */}
                        <button
                          onClick={() => { toggleCat(key); setAdding(null) }}
                          className="w-full flex items-center justify-between py-2 hover:bg-zinc-800/40 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-zinc-300 text-sm font-semibold">{label}</span>
                            {items.length > 0 && (
                              <span className="text-zinc-600 text-xs">{items.length} item{items.length > 1 ? 's' : ''}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-zinc-400 text-sm font-semibold">{formatCurrency(subtotal)}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                          </span>
                        </button>

                        {/* Itens expandidos */}
                        {isExpanded && (
                          <div className="ml-4 space-y-1 mt-1 mb-2">
                            {items.map(d => (
                              <div key={d.id} className="flex items-center justify-between py-1.5 group">
                                {editing?.id === d.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <input
                                      value={editing.descricao}
                                      onChange={e => setEditing(s => s ? { ...s, descricao: e.target.value } : s)}
                                      className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                    <input
                                      type="number"
                                      value={editing.valor}
                                      onChange={e => setEditing(s => s ? { ...s, valor: e.target.value } : s)}
                                      placeholder="0,00"
                                      className="w-24 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                    <button onClick={handleEdit} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-zinc-400 text-sm flex-1">{d.descricao}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-zinc-300 text-sm font-medium">{formatCurrency(Number(d.valor))}</span>
                                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditing({ id: d.id, descricao: d.descricao, valor: String(d.valor) })} className="text-zinc-500 hover:text-white transition-colors">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(d.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}

                            {isAddingThis ? (
                              <div className="flex items-center gap-2 py-1.5">
                                <input
                                  autoFocus
                                  value={adding.descricao}
                                  onChange={e => setAdding(s => s ? { ...s, descricao: e.target.value } : s)}
                                  placeholder="Descrição"
                                  className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                />
                                <input
                                  type="number"
                                  value={adding.valor}
                                  onChange={e => setAdding(s => s ? { ...s, valor: e.target.value } : s)}
                                  placeholder="0,00"
                                  className="w-24 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                />
                                <button onClick={() => handleAdd(key)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setAdding(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAdding({ categoria: key, descricao: '', valor: '' })}
                                className="flex items-center gap-1.5 text-zinc-600 hover:text-emerald-400 text-xs transition-colors py-1"
                              >
                                <Plus className="w-3 h-3" />
                                Adicionar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-zinc-700 mt-4 pt-3 flex items-center justify-between">
                  <span className="text-zinc-400 text-sm font-semibold">Total Despesas</span>
                  <span className="text-red-400 font-bold text-sm">{formatCurrency(totalDespesas)}</span>
                </div>
              </div>

              {/* RESULTADO */}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Resultado</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-300 text-sm">Lucro Líquido</span>
                    <span className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(lucro)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-300 text-sm">Margem</span>
                    <span className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {margem.toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                </div>
              </div>

              {/* DISTRIBUIÇÃO DE LUCRO */}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Distribuição do Lucro</p>
                <div className="space-y-2">
                  {[
                    { nome: 'Francisco', pct: 45.5 },
                    { nome: 'Renan',     pct: 45.5 },
                    { nome: 'Felipe',    pct: 5.0  },
                    { nome: 'Marcelo',   pct: 4.0  },
                  ].map(({ nome, pct }) => {
                    const valor = lucro * (pct / 100)
                    return (
                      <div key={nome} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-300 text-sm w-20">{nome}</span>
                          <div className="w-24 bg-zinc-800 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${isPositive ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-zinc-500 text-xs">{pct}%</span>
                        </div>
                        <span className={`font-semibold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(valor)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Seção de Conciliação Bancária OFX */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                Conciliação Bancária — Extrato OFX
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">Importe o extrato do banco para lançar despesas automaticamente no DRE</p>
            </div>
            <div className="flex items-center gap-2">
              {ofxDone > 0 && (
                <span className="text-emerald-400 text-xs font-medium">{ofxDone} despesa{ofxDone > 1 ? 's' : ''} adicionada{ofxDone > 1 ? 's' : ''} ✓</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.OFX"
                onChange={handleOFXUpload}
                className="hidden"
              />
              <button
                onClick={() => { setOfxDone(0); fileInputRef.current?.click() }}
                disabled={ofxLoading}
                className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {ofxLoading ? 'Processando...' : 'Importar .OFX'}
              </button>
            </div>
          </div>

          {ofxError && (
            <div className="px-6 py-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border-b border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {ofxError}
            </div>
          )}

          {ofxTxs.length > 0 ? (
            <div className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-zinc-400 text-sm">
                  <span className="text-white font-semibold">{ofxTxs.length}</span> transações de <span className="text-white font-semibold">{formatMesLabel(mes)}</span> encontradas
                  {ofxParaConciliar > 0 && <span className="text-emerald-400"> · {ofxParaConciliar} serão lançadas no DRE</span>}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setOfxTxs([]); setOfxCats({}); setOfxDescricoes({}) }}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConciliar}
                    disabled={ofxConciliando || ofxParaConciliar === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    {ofxConciliando ? 'Lançando...' : `Lançar ${ofxParaConciliar} no DRE`}
                  </button>
                </div>
              </div>

              {/* Legenda rápida */}
              <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
                <button onClick={() => setOfxCats(prev => { const n = { ...prev }; ofxTxs.forEach(t => { if (t.tipo !== 'CREDIT') n[t.fitid] = 'variavel' }); return n })} className="hover:text-zinc-300 transition-colors underline">Selecionar todos débitos</button>
                <button onClick={() => setOfxCats(prev => { const n = { ...prev }; ofxTxs.forEach(t => { n[t.fitid] = 'ignorar' }); return n })} className="hover:text-zinc-300 transition-colors underline">Ignorar todos</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left">
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Data</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2">Descrição</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Tipo</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap text-right">Valor</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Categoria DRE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {ofxTxs.map(t => {
                      const cat = ofxCats[t.fitid] ?? 'ignorar'
                      const isIgnored = cat === 'ignorar'
                      return (
                        <tr key={t.fitid} className={`transition-colors ${isIgnored ? 'opacity-40' : ''}`}>
                          <td className="py-2 px-2 text-zinc-400 text-xs whitespace-nowrap">{t.data}</td>
                          <td className="py-2 px-2">
                            <input
                              value={ofxDescricoes[t.fitid] ?? t.descricao}
                              onChange={e => setOfxDescricoes(prev => ({ ...prev, [t.fitid]: e.target.value }))}
                              disabled={isIgnored}
                              className="w-full bg-transparent text-zinc-300 text-xs focus:outline-none focus:text-white disabled:text-zinc-600 border-b border-transparent focus:border-zinc-600 transition-colors"
                            />
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className={`text-xs font-medium ${t.tipo === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.tipo === 'CREDIT' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-right">
                            <span className={`text-sm font-semibold ${t.tipo === 'CREDIT' ? 'text-emerald-400' : 'text-white'}`}>
                              {t.tipo === 'CREDIT' ? '+' : '-'}{formatCurrency(t.valor)}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={cat}
                              onChange={e => setOfxCats(prev => ({ ...prev, [t.fitid]: e.target.value as OFXCategoria }))}
                              className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                            >
                              <option value="ignorar">Ignorar</option>
                              <option value="fixa">Despesas Fixas</option>
                              <option value="variavel">Despesas Variáveis</option>
                              <option value="pix">Tarifas Pix</option>
                              <option value="pessoal">Despesas com Pessoal</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <Upload className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhum extrato carregado</p>
              <p className="text-zinc-600 text-xs mt-1">Importe um arquivo .OFX do seu banco para fazer a conciliação do mês de {formatMesLabel(mes)}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
