'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { KPI_LABELS as L } from '@/lib/calculos'
import { ChevronLeft, ChevronRight, RefreshCw, Pencil, Check, X } from 'lucide-react'

type Consultor = {
  nome: string
  deals: number
  receita: number
  leads: number
  leadsHoje: number
  taxaConversao: number
}

type ClintData = {
  mes: string
  receita: number
  totalDeals: number
  totalLeads: number
  leadsHoje: number
  taxaConversao: number
  consultores: Consultor[]
}

type MetaVendedor = {
  vendedor: string
  mes: string
  meta: number
  meta_leads: number
  meta_conversao: number
  meta_ticket: number
}

function getCurrentMes() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getExpectedPct(mes: string) {
  const now = new Date()
  const currentMes = getCurrentMes()
  if (mes !== currentMes) return 100
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Math.min((now.getDate() / daysInMonth) * 100, 100)
}

function ProgressBar({ value, target, expectedPct, colorClass }: {
  value: number
  target: number
  expectedPct: number
  colorClass: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const ahead = pct >= expectedPct
  return (
    <div className="relative w-full bg-zinc-800 rounded-full h-2 overflow-visible my-1">
      <div
        className={`h-2 rounded-full transition-all ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
      {target > 0 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${expectedPct}%` }}
          title={`Meta esperada hoje: ${expectedPct.toFixed(0)}%`}
        >
          <div className={`w-2.5 h-2.5 rounded-full border-2 ${ahead ? 'border-emerald-400 bg-zinc-900' : 'border-zinc-300 bg-zinc-900'}`} />
        </div>
      )}
    </div>
  )
}

function addMonth(mes: string, delta: number) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${months[m - 1]} ${y}`
}

function VendedoresInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const today = new Date().toLocaleDateString('sv-SE')
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today
  const mes = start.slice(0, 7)

  function setMes(newMes: string) {
    const [y, mo] = newMes.split('-').map(Number)
    const newStart = `${newMes}-01`
    const newEnd = newMes === getCurrentMes()
      ? new Date().toLocaleDateString('sv-SE')
      : new Date(y, mo, 0).toLocaleDateString('sv-SE')
    const params = new URLSearchParams(searchParams.toString())
    params.set('start', newStart)
    params.set('end', newEnd)
    router.push(`${pathname}?${params.toString()}`)
  }

  const [data, setData] = useState<ClintData | null>(null)
  const [leads, setLeads] = useState<{ totalLeads: number; leadsHoje: number; taxaConversao: number } | null>(null)
  const [metas, setMetas] = useState<MetaVendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [lastSync, setLastSync] = useState('')
  const [trafego, setTrafego] = useState(0)
  const [trafegoGoogle, setTrafegoGoogle] = useState(0)
  const [loadingTrafego, setLoadingTrafego] = useState(true)
  const [spendVendedor, setSpendVendedor] = useState<Record<string, number>>({})
  const [spendGoogle, setSpendGoogle] = useState<Record<string, number>>({})
  const [editandoMeta, setEditandoMeta] = useState<string | null>(null)
  const [editMetaReceita, setEditMetaReceita] = useState('')
  const [editMetaLeads, setEditMetaLeads] = useState('')

  const load = useCallback(async (s: string, e: string) => {
    const m = s.slice(0, 7)
    setLoading(true)
    setLoadingLeads(true)
    setLoadingTrafego(true)
    setData(null)
    setLeads(null)
    setMetas([])
    setTrafego(0)
    setTrafegoGoogle(0)
    setSpendVendedor({})
    setSpendGoogle({})

    const [r, mr, sv, gv] = await Promise.all([
      fetch(`/api/clint?mes=${m}&start=${s}&end=${e}&t=${Date.now()}`),
      fetch(`/api/metas-vendedor?mes=${m}`),
      fetch(`/api/integrations/meta-vendedores?start=${s}&end=${e}`),
      fetch(`/api/integrations/google-ads?start=${s}&end=${e}`),
    ])
    const json = await r.json()
    const metasJson = await mr.json()
    const svJson = await sv.json()
    const gvJson = await gv.json()
    if (!json.error) {
      setData(json)
      setLeads({ totalLeads: json.totalLeads ?? 0, leadsHoje: json.leadsHoje ?? 0, taxaConversao: json.taxaConversao ?? 0 })
      setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }
    setMetas(Array.isArray(metasJson) ? metasJson : [])
    setTrafego(svJson.totalSpend ?? 0)
    setTrafegoGoogle(Object.values(gvJson.spendByVendedor ?? {}).reduce((s: number, v) => s + (v as number), 0))
    setSpendVendedor(svJson.spendByVendedor ?? {})
    setSpendGoogle(gvJson.spendByVendedor ?? {})
    setLoadingTrafego(false)
    setLoading(false)
    setLoadingLeads(false)
  }, [])

  useEffect(() => { load(start, end) }, [start, end, load])

  async function salvarMeta(nome: string) {
    const meta = parseFloat(editMetaReceita) || 0
    const meta_leads = parseInt(editMetaLeads) || 0
    await fetch('/api/metas-vendedor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedor: nome, mes, meta, meta_leads }),
    })
    setMetas(prev => {
      const exists = prev.find(m => m.vendedor === nome)
      if (exists) return prev.map(m => m.vendedor === nome ? { ...m, meta, meta_leads } : m)
      return [...prev, { vendedor: nome, mes, meta, meta_leads, meta_conversao: 0, meta_ticket: 0 }]
    })
    setEditandoMeta(null)
  }

  function normalizarNome(n: string) {
    return n.replace(/#\d*\s*/g, '').replace(/[#@!]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  }

  function getMeta(nome: string) {
    const nomeNorm = normalizarNome(nome)
    return metas.find(m => normalizarNome(m.vendedor) === nomeNorm) ?? { meta: 0, meta_leads: 0, meta_conversao: 0, meta_ticket: 0 }
  }

  function getSpend(nome: string) {
    const nomeNorm = normalizarNome(nome)
    const meta = Object.entries(spendVendedor).find(([k]) => normalizarNome(k) === nomeNorm)?.[1] ?? 0
    const google = Object.entries(spendGoogle).find(([k]) => normalizarNome(k) === nomeNorm)?.[1] ?? 0
    return meta + google
  }

  const consultores = data?.consultores ?? []
  const totalReceita = data?.receita ?? 0
  const totalDeals = data?.totalDeals ?? 0
  const leadsHoje = leads?.leadsHoje ?? 0
  const taxaConversao = leads?.taxaConversao ?? 0
  const ticketMedio = totalDeals > 0 ? totalReceita / totalDeals : 0
  const totalSpend = trafego + trafegoGoogle
  const roas = totalSpend > 0 ? totalReceita / totalSpend : 0
  const expectedPctGeral = getExpectedPct(mes)
  const metaTotal = consultores.reduce((s, c) => s + (getMeta(c.nome).meta || 0), 0)
  const metaLeadsTotal = consultores.reduce((s, c) => s + (getMeta(c.nome).meta_leads || 0), 0)
  const totalLeadsConsultores = consultores.reduce((s, c) => s + (c.leads || 0), 0)
  const expectedReceita = metaTotal * (expectedPctGeral / 100)
  const expectedLeads = metaLeadsTotal * (expectedPctGeral / 100)
  const receitaPaceRatio = expectedReceita > 0 ? (totalReceita / expectedReceita) * 100 : 0
  const leadsPaceRatio = expectedLeads > 0 ? (totalLeadsConsultores / expectedLeads) * 100 : 0
  // Médias de meta de conversão e ticket (apenas consultores com meta definida)
  const consultoresComMetaConversao = consultores.filter(c => getMeta(c.nome).meta_conversao > 0)
  const consultoresComMetaTicket = consultores.filter(c => getMeta(c.nome).meta_ticket > 0)
  const avgMetaConversao = consultoresComMetaConversao.length > 0
    ? consultoresComMetaConversao.reduce((s, c) => s + getMeta(c.nome).meta_conversao, 0) / consultoresComMetaConversao.length
    : 0
  const avgMetaTicket = consultoresComMetaTicket.length > 0
    ? consultoresComMetaTicket.reduce((s, c) => s + getMeta(c.nome).meta_ticket, 0) / consultoresComMetaTicket.length
    : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Consultores" lastSync={loading ? 'carregando...' : `atualizado às ${lastSync}`} />

      <div className="p-6 space-y-6">

        {/* Seletor de mês */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMes(addMonth(mes, -1))} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white font-semibold text-base min-w-[140px] text-center">{formatMesLabel(mes)}</span>
            <button onClick={() => setMes(addMonth(mes, 1))} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => load(start, end)} disabled={loading} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* KPIs gerais */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">{L.receitaTotal}</p>
            <p className="text-emerald-400 font-bold text-2xl">{loading ? '...' : formatCurrency(totalReceita)}</p>
            {!loading && metaTotal > 0 && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-zinc-500 text-xs">Esperado: {formatCurrency(expectedReceita)}</p>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${receitaPaceRatio >= 100 ? 'bg-emerald-500/20 text-emerald-400' : receitaPaceRatio >= 80 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {receitaPaceRatio >= 100 ? `+${(receitaPaceRatio - 100).toFixed(0)}% ritmo` : `${(receitaPaceRatio - 100).toFixed(0)}% ritmo`}
                </span>
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">{L.leads}</p>
            <p className="text-white font-bold text-2xl">{loadingLeads ? '...' : formatNumber(totalLeadsConsultores)}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-zinc-500 text-xs">Hoje: {loadingLeads ? '...' : leadsHoje}</p>
              {!loadingLeads && metaLeadsTotal > 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${leadsPaceRatio >= 100 ? 'bg-emerald-500/20 text-emerald-400' : leadsPaceRatio >= 80 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {leadsPaceRatio >= 100 ? `+${(leadsPaceRatio - 100).toFixed(0)}% ritmo` : `${(leadsPaceRatio - 100).toFixed(0)}% ritmo`}
                </span>
              )}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">{L.conversao}</p>
            <p className="text-white font-bold text-2xl">{loadingLeads ? '...' : `${taxaConversao.toFixed(1)}%`}</p>
            {!loadingLeads && avgMetaConversao > 0 && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-zinc-500 text-xs">Meta média: {avgMetaConversao.toFixed(1)}%</p>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${taxaConversao >= avgMetaConversao ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {taxaConversao >= avgMetaConversao ? `+${(taxaConversao - avgMetaConversao).toFixed(1)}pp` : `${(taxaConversao - avgMetaConversao).toFixed(1)}pp`}
                </span>
              </div>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">{L.ticketMedio}</p>
            <p className="text-white font-bold text-2xl">{loading ? '...' : formatCurrency(ticketMedio)}</p>
            {!loading && avgMetaTicket > 0 && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-zinc-500 text-xs">Meta média: {formatCurrency(avgMetaTicket)}</p>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ticketMedio >= avgMetaTicket ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {ticketMedio >= avgMetaTicket ? `+${(((ticketMedio / avgMetaTicket) - 1) * 100).toFixed(0)}%` : `${(((ticketMedio / avgMetaTicket) - 1) * 100).toFixed(0)}%`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">{L.trafego}</p>
            <p className="text-orange-400 font-bold text-2xl">{loadingTrafego ? '...' : formatCurrency(totalSpend)}</p>
            {!loadingTrafego && trafegoGoogle > 0 && (
              <p className="text-zinc-500 text-xs mt-1">Meta: {formatCurrency(trafego)} · Google: {formatCurrency(trafegoGoogle)}</p>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">ROAS</p>
            <p className="text-white font-bold text-2xl">{loadingTrafego || loading ? '...' : roas > 0 ? `${roas.toFixed(2)}x` : '—'}</p>
            {!loadingTrafego && !loading && roas > 0 && (
              <p className="text-zinc-500 text-xs mt-1">R$ {roas.toFixed(2)} por R$ 1 investido</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-zinc-500 text-sm text-center py-8">Carregando dados do Clint...</div>
        ) : consultores.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-8">Nenhum deal ganho em {formatMesLabel(mes)}</div>
        ) : (
          <>
            {/* Cards por consultor */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {consultores.map((v, i) => {
                const pct = totalReceita > 0 ? (v.receita / totalReceita) * 100 : 0
                const ticket = v.deals > 0 ? v.receita / v.deals : 0
                const { meta, meta_leads, meta_conversao, meta_ticket } = getMeta(v.nome)
                const pctMeta = meta > 0 ? Math.min((v.receita / meta) * 100, 100) : 0
                const pctLeads = meta_leads > 0 ? Math.min((v.leads / meta_leads) * 100, 100) : 0
                const expectedPct = getExpectedPct(mes)
                const spend = getSpend(v.nome)
                const cpl = spend > 0 && v.leads > 0 ? spend / v.leads : 0
                const isEditando = editandoMeta === v.nome
                // live preview enquanto edita
                const previewMeta = isEditando ? (parseFloat(editMetaReceita) || 0) : meta
                const previewMetaLeads = isEditando ? (parseInt(editMetaLeads) || 0) : meta_leads
                const previewPctMeta = previewMeta > 0 ? Math.min((v.receita / previewMeta) * 100, 100) : 0
                const previewPctLeads = previewMetaLeads > 0 ? Math.min((v.leads / previewMetaLeads) * 100, 100) : 0
                return (
                  <div key={v.nome} className={`bg-zinc-900 border rounded-xl overflow-hidden ${i === 0 ? 'border-yellow-500/30' : 'border-zinc-800'}`}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`}</span>
                        <div className="min-w-0">
                          <h3 className="text-white font-semibold text-sm truncate">{v.nome}</h3>
                          <p className="text-zinc-500 text-xs">{pct.toFixed(1)}% da receita</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (isEditando) { setEditandoMeta(null) }
                          else { setEditandoMeta(v.nome); setEditMetaReceita(String(meta || '')); setEditMetaLeads(String(meta_leads || '')) }
                        }}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isEditando ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Painel de metas (lapiseira) */}
                    {isEditando && (
                      <div className="mx-5 mb-4 rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 space-y-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Meta do mês</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => salvarMeta(v.nome)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-colors">
                              <Check className="w-3 h-3" /> Salvar
                            </button>
                            <button onClick={() => setEditandoMeta(null)} className="p-1.5 rounded-lg bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Meta de Receita */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-zinc-400 text-xs font-medium">Meta de Receita</span>
                            {previewMeta > 0 && (
                              <span className={`text-xs font-bold ${previewPctMeta >= 100 ? 'text-emerald-400' : previewPctMeta >= expectedPct ? 'text-yellow-400' : 'text-zinc-400'}`}>
                                {previewPctMeta.toFixed(0)}% atingido
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-zinc-500 text-xs">Realizado:</span>
                            <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(v.receita)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-xs whitespace-nowrap">Meta (R$):</span>
                            <input
                              type="text" inputMode="decimal"
                              value={editMetaReceita}
                              onChange={e => setEditMetaReceita(e.target.value)}
                              className="flex-1 bg-zinc-900 border border-zinc-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors"
                              placeholder="Ex: 60000"
                              autoFocus
                            />
                          </div>
                          {previewMeta > 0 && (
                            <div className="mt-2">
                              <ProgressBar value={v.receita} target={previewMeta} expectedPct={expectedPct}
                                colorClass={previewPctMeta >= 100 ? 'bg-emerald-500' : previewPctMeta >= expectedPct ? 'bg-yellow-500' : 'bg-blue-500'} />
                              <div className="flex justify-between mt-0.5">
                                <span className="text-zinc-600 text-[11px]">{formatCurrency(v.receita)} / {formatCurrency(previewMeta)}</span>
                                {expectedPct > 0 && (
                                  <span className={`text-[11px] font-semibold ${(previewPctMeta / expectedPct) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {((previewPctMeta / expectedPct) * 100).toFixed(0)}% do ritmo
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Meta de Leads */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-zinc-400 text-xs font-medium">Meta de Leads</span>
                            {previewMetaLeads > 0 && (
                              <span className={`text-xs font-bold ${previewPctLeads >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                {previewPctLeads.toFixed(0)}% atingido
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-zinc-500 text-xs">Realizado:</span>
                            <span className="text-violet-400 font-semibold text-sm">{v.leads} leads</span>
                            <span className="text-zinc-600 text-xs">· hoje: {v.leadsHoje}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-xs whitespace-nowrap">Meta (leads):</span>
                            <input
                              type="text" inputMode="numeric"
                              value={editMetaLeads}
                              onChange={e => setEditMetaLeads(e.target.value)}
                              className="flex-1 bg-zinc-900 border border-zinc-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 transition-colors"
                              placeholder="Ex: 700"
                            />
                          </div>
                          {previewMetaLeads > 0 && (
                            <div className="mt-2">
                              <ProgressBar value={v.leads} target={previewMetaLeads} expectedPct={expectedPct}
                                colorClass={previewPctLeads >= 100 ? 'bg-emerald-500' : 'bg-violet-500'} />
                              <span className="text-zinc-600 text-[11px]">{v.leads} / {previewMetaLeads} meta</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Barras de progresso normais */}
                    <div className="px-5 pb-4 space-y-3">
                      {/* Receita */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-500 text-xs">Receita</span>
                          {meta > 0 && (
                            <span className={`text-xs font-semibold ${pctMeta >= 100 ? 'text-emerald-400' : pctMeta >= expectedPct ? 'text-yellow-400' : 'text-zinc-400'}`}>
                              {pctMeta.toFixed(0)}% da meta
                            </span>
                          )}
                        </div>
                        <ProgressBar
                          value={v.receita} target={meta} expectedPct={expectedPct}
                          colorClass={meta > 0 ? (pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= expectedPct ? 'bg-yellow-500' : 'bg-blue-500') : 'bg-emerald-500/70'}
                        />
                        {meta > 0 && (
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-zinc-600 text-xs">{formatCurrency(v.receita)} / {formatCurrency(meta)}</p>
                            {expectedPct > 0 && (
                              <p className={`text-xs font-semibold ${(pctMeta / expectedPct) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {((pctMeta / expectedPct) * 100).toFixed(0)}% do ritmo
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Leads */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-500 text-xs">Leads recebidos</span>
                          {meta_leads > 0 && (
                            <span className={`text-xs font-semibold ${pctLeads >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                              {pctLeads.toFixed(0)}% da meta
                            </span>
                          )}
                        </div>
                        <ProgressBar value={v.leads} target={meta_leads} expectedPct={expectedPct}
                          colorClass={pctLeads >= 100 ? 'bg-emerald-500' : 'bg-violet-500'} />
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold text-sm">{loadingLeads ? '...' : v.leads}</span>
                            <span className="text-zinc-600 text-xs">{meta_leads > 0 ? `/ ${meta_leads} meta` : 'leads'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500 text-xs">Hoje:</span>
                            <span className={`text-sm font-semibold ${v.leadsHoje > 0 ? 'text-violet-400' : 'text-zinc-600'}`}>
                              {loadingLeads ? '...' : v.leadsHoje}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPIs grid */}
                    <div className="mx-5 mb-5 pt-3 border-t border-zinc-800 grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <p className="text-zinc-500 text-xs">Receita</p>
                        <p className="text-emerald-400 font-bold text-sm mt-0.5">{formatCurrency(v.receita)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-500 text-xs">Ganhos</p>
                        <p className="text-white font-bold text-xl mt-0.5">{v.deals}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-500 text-xs">Ticket</p>
                        <p className="text-white font-semibold text-sm mt-0.5">{formatCurrency(ticket)}</p>
                        {meta_ticket > 0 && (
                          <p className={`text-xs mt-0.5 ${ticket >= meta_ticket ? 'text-emerald-400' : 'text-red-400'}`}>
                            meta {formatCurrency(meta_ticket)}
                          </p>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-500 text-xs">Conversão</p>
                        <p className="text-white font-semibold text-sm mt-0.5">{loadingLeads ? '...' : `${v.taxaConversao.toFixed(1)}%`}</p>
                        {meta_conversao > 0 && (
                          <p className={`text-xs mt-0.5 ${v.taxaConversao >= meta_conversao ? 'text-emerald-400' : 'text-red-400'}`}>
                            meta {meta_conversao.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>

                    {spend > 0 && (
                      <div className="mx-5 mb-5 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <p className="text-zinc-500 text-xs">Tráfego</p>
                          <p className="text-orange-400 font-semibold text-sm mt-0.5">{formatCurrency(spend)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-zinc-500 text-xs">CPL</p>
                          <p className="text-zinc-300 font-semibold text-sm mt-0.5">{cpl > 0 ? formatCurrency(cpl) : '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Ranking tabela */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Ranking — {formatMesLabel(mes)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {['#', 'Consultor', 'Leads', 'Hoje', 'Ganhos', 'Meta Leads', '% Leads', 'Conversão', 'Receita', 'Meta R$', '% Meta', 'Ticket'].map(h => (
                        <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {consultores.map((v, i) => {
                      const ticket = v.deals > 0 ? v.receita / v.deals : 0
                      const { meta, meta_leads } = getMeta(v.nome)
                      const pctMeta = meta > 0 ? (v.receita / meta) * 100 : 0
                      const pctLeads = meta_leads > 0 ? (v.leads / meta_leads) * 100 : 0
                      const expectedPct = getExpectedPct(mes)
                      return (
                        <tr key={v.nome} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-3 text-zinc-500 text-xs">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`}
                          </td>
                          <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{v.nome}</td>
                          <td className="py-3 px-3 text-white font-semibold">{loadingLeads ? '...' : v.leads}</td>
                          <td className="py-3 px-3 text-zinc-400">{loadingLeads ? '...' : v.leadsHoje}</td>
                          <td className="py-3 px-3 text-white font-semibold">{v.deals}</td>
                          <td className="py-3 px-3 text-zinc-400">{meta_leads > 0 ? meta_leads : '—'}</td>
                          <td className="py-3 px-3">
                            {meta_leads > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-14">
                                  <ProgressBar value={v.leads} target={meta_leads} expectedPct={expectedPct} colorClass={pctLeads >= 100 ? 'bg-emerald-500' : 'bg-purple-500'} />
                                </div>
                                <span className={`text-xs ${pctLeads >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctLeads.toFixed(0)}%</span>
                              </div>
                            ) : <span className="text-zinc-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-3 text-zinc-300 text-xs">{loadingLeads ? '...' : `${v.taxaConversao.toFixed(1)}%`}</td>
                          <td className="py-3 px-3 text-emerald-400 font-semibold">{formatCurrency(v.receita)}</td>
                          <td className="py-3 px-3 text-zinc-400">{meta > 0 ? formatCurrency(meta) : '—'}</td>
                          <td className="py-3 px-3">
                            {meta > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-14">
                                  <ProgressBar value={v.receita} target={meta} expectedPct={expectedPct} colorClass={pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= expectedPct ? 'bg-yellow-500' : 'bg-blue-500'} />
                                </div>
                                <span className={`text-xs ${pctMeta >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctMeta.toFixed(0)}%</span>
                              </div>
                            ) : <span className="text-zinc-600 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-3 text-zinc-300">{formatCurrency(ticket)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pódio */}
              {consultores.length >= 3 && (
                <div className="mt-8 flex items-end justify-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">🥈</span>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">{consultores[1].nome.split(' ')[0]}</p>
                      <p className="text-zinc-400 text-xs">{formatCurrency(consultores[1].receita)}</p>
                    </div>
                    <div className="w-24 bg-zinc-600 rounded-t-lg flex items-center justify-center" style={{ height: '80px' }}>
                      <span className="text-zinc-300 font-bold text-2xl">2</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🥇</span>
                    <div className="text-center">
                      <p className="text-white font-bold text-sm">{consultores[0].nome.split(' ')[0]}</p>
                      <p className="text-emerald-400 text-xs font-semibold">{formatCurrency(consultores[0].receita)}</p>
                    </div>
                    <div className="w-24 bg-yellow-500/20 border border-yellow-500/30 rounded-t-lg flex items-center justify-center" style={{ height: '120px' }}>
                      <span className="text-yellow-400 font-bold text-2xl">1</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">🥉</span>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">{consultores[2].nome.split(' ')[0]}</p>
                      <p className="text-zinc-400 text-xs">{formatCurrency(consultores[2].receita)}</p>
                    </div>
                    <div className="w-24 bg-orange-900/30 rounded-t-lg flex items-center justify-center" style={{ height: '60px' }}>
                      <span className="text-orange-400 font-bold text-2xl">3</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default function VendedoresPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-500">Carregando...</div>}>
      <VendedoresInner />
    </Suspense>
  )
}
// Tue Mar 24 20:24:35 -03 2026
