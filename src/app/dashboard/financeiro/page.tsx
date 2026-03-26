'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Upload,
  FileText,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Users,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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

function mesLabelShort(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  })
}

const CATEGORIAS = [
  { key: 'fixa', label: 'Despesas Fixas' },
  { key: 'variavel', label: 'Despesas Variáveis' },
  { key: 'pix', label: 'Tarifas Pix' },
  { key: 'pessoal', label: 'Despesas com Pessoal' },
] as const

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl text-xs space-y-1">
      <p className="text-zinc-400 font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  colorClass,
  bgClass,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
  colorClass: string
  bgClass: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgClass}`}>
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        </div>
      </div>
      <p className="text-white font-bold text-2xl leading-tight">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1 truncate">{sub}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  // OFX
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ofxTxs, setOfxTxs] = useState<OFXTransaction[]>([])
  const [ofxCats, setOfxCats] = useState<Record<string, OFXCategoria>>({})
  const [ofxDescricoes, setOfxDescricoes] = useState<Record<string, string>>({})
  const [ofxLoading, setOfxLoading] = useState(false)
  const [ofxError, setOfxError] = useState('')
  const [ofxConciliando, setOfxConciliando] = useState(false)
  const [ofxDone, setOfxDone] = useState(0)

  // Historical data for chart (last 6 months)
  const [histDespesas, setHistDespesas] = useState<Record<string, number>>({})
  const [histReceita, setHistReceita] = useState<Record<string, number>>({})

  function toggleCat(key: string) {
    setExpandedCats(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  async function loadDespesas(m: string) {
    const r = await fetch(`/api/despesas?mes=${m}`)
    const data = await r.json()
    setDespesas(Array.isArray(data) ? data : [])
  }

  async function loadContratos() {
    const r = await fetch('/api/contratos')
    const data = await r.json()
    const total = Array.isArray(data) ? data.reduce((s: number, c: { taxa?: number }) => s + (c.taxa ?? 0), 0) : 0
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

  async function loadHistorical() {
    try {
      const today = new Date()
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const [dRes, cRes] = await Promise.all([
        fetch('/api/despesas'),
        fetch('/api/contratos'),
      ])
      const allDespesas: Despesa[] = dRes.ok ? await dRes.json() : []
      const allContratos: { taxa?: number; created_at: string }[] = cRes.ok ? await cRes.json() : []

      const dMap: Record<string, number> = {}
      const rMap: Record<string, number> = {}
      months.forEach(m => {
        dMap[m] = Array.isArray(allDespesas)
          ? allDespesas.filter(d => d.mes === m || d.created_at?.slice(0, 7) === m).reduce((s, d) => s + Number(d.valor), 0)
          : 0
        rMap[m] = Array.isArray(allContratos)
          ? allContratos.filter(c => c.created_at?.slice(0, 7) === m).reduce((s, c) => s + (c.taxa ?? 0), 0)
          : 0
      })
      setHistDespesas(dMap)
      setHistReceita(rMap)
    } catch {
      // silent
    }
  }

  async function load(m: string) {
    setLoading(true)
    await Promise.all([loadDespesas(m), loadContratos(), loadMetaAds(m)])
    setLoading(false)
  }

  useEffect(() => { load(mes) }, [mes])
  useEffect(() => { loadHistorical() }, [])

  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0) + (metaAdsSpend ?? 0)
  const lucro = receita - totalDespesas
  const margem = receita > 0 ? (lucro / receita) * 100 : 0
  const isPositive = lucro >= 0

  // ── Chart data ──
  const chartData = useMemo(() => {
    const today = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(m => ({
      mes: mesLabelShort(m + '-01'),
      Receita: histReceita[m] ?? 0,
      Despesas: histDespesas[m] ?? 0,
      Lucro: (histReceita[m] ?? 0) - (histDespesas[m] ?? 0),
    }))
  }, [histReceita, histDespesas])

  // ── CRUD ──
  async function handleAdd(categoria: string) {
    if (!adding || saving || !adding.descricao.trim()) return
    setSaving(true)
    await fetch('/api/despesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: adding.descricao, categoria, valor: parseFloat(adding.valor) || 0, mes }),
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
      body: JSON.stringify({ id: editing.id, descricao: editing.descricao, valor: parseFloat(editing.valor) || 0 }),
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

  // ── OFX ──
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
      const filtered = txs.filter(t => t.mes === mes)
      setOfxTxs(filtered)
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
        body: JSON.stringify({ descricao: ofxDescricoes[t.fitid] || t.descricao, categoria: ofxCats[t.fitid], valor: t.valor, mes }),
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
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Financeiro" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── NAVEGAÇÃO DE MÊS ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMes(m => addMonth(m, -1))}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-base min-w-[160px] text-center">
            {formatMesLabel(mes)}
          </span>
          <button
            onClick={() => setMes(m => addMonth(m, 1))}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {loading && <span className="text-zinc-500 text-xs animate-pulse">Carregando...</span>}
        </div>

        {/* ── ALERTAS ── */}
        {!loading && (totalDespesas > receita && receita > 0 || lucro < 0) && (
          <div className="space-y-2">
            {totalDespesas > receita && receita > 0 && (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-yellow-300 text-sm">
                  Atenção: as despesas ({formatCurrency(totalDespesas)}) superam a receita ({formatCurrency(receita)}) em {formatMesLabel(mes)}.
                </p>
              </div>
            )}
            {lucro < 0 && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">
                  Lucro negativo em {formatMesLabel(mes)}: {formatCurrency(lucro)}. Revise as despesas ou aumente a receita.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label="Receita"
            value={formatCurrency(receita)}
            sub="soma das taxas de contratos"
            icon={DollarSign}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label="Total Despesas"
            value={formatCurrency(totalDespesas)}
            sub={`${despesas.length} lançamento${despesas.length !== 1 ? 's' : ''} em ${formatMesLabel(mes)}`}
            icon={TrendingDown}
            color="#EF4444"
            colorClass="text-red-400"
            bgClass="bg-red-500/10"
          />
          <KpiCard
            label="Lucro Líquido"
            value={formatCurrency(lucro)}
            sub="receita menos despesas"
            icon={isPositive ? TrendingUp : TrendingDown}
            color={isPositive ? '#10B981' : '#EF4444'}
            colorClass={isPositive ? 'text-emerald-400' : 'text-red-400'}
            bgClass={isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
          <KpiCard
            label="Margem"
            value={`${margem.toFixed(1).replace('.', ',')}%`}
            sub="lucro / receita"
            icon={Percent}
            color={isPositive ? '#10B981' : '#EF4444'}
            colorClass={isPositive ? 'text-emerald-400' : 'text-red-400'}
            bgClass={isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
        </div>

        {/* ── ESTRUTURA FINANCEIRA ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Estrutura Financeira — {formatMesLabel(mes)}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Receita', value: receita, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
              { label: 'Despesas', value: totalDespesas, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
              {
                label: 'Lucro', value: lucro,
                bg: isPositive ? 'bg-violet-500/10' : 'bg-red-500/10',
                border: isPositive ? 'border-violet-500/30' : 'border-red-500/30',
                text: isPositive ? 'text-violet-400' : 'text-red-400',
              },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`${item.bg} border ${item.border} rounded-xl px-4 py-3 text-center min-w-[120px]`}>
                  <p className="text-zinc-500 text-xs mb-1">{item.label}</p>
                  <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.value)}</p>
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* ── GRÁFICO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Evolução Mensal — Últimos 6 Meses</h3>
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <linearGradient id="finGradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="finGradRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="finGradViolet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 12 }} />
              <Area type="monotone" dataKey="Receita" stroke="#10B981" strokeWidth={2} fill="url(#finGradGreen)" dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
              <Area type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} fill="url(#finGradRed)" dot={false} activeDot={{ r: 4, fill: '#EF4444' }} />
              <Area type="monotone" dataKey="Lucro" stroke="#8B5CF6" strokeWidth={2} fill="url(#finGradViolet)" dot={false} activeDot={{ r: 4, fill: '#8B5CF6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── DRE ── */}
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
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-300 text-sm">Taxas de Contratos</span>
                  <span className="text-white font-medium text-sm">{formatCurrency(receita)}</span>
                </div>
                <div className="border-t border-zinc-700 mt-3 pt-3 flex items-center justify-between">
                  <span className="text-zinc-400 text-sm font-semibold">Total Receitas</span>
                  <span className="text-emerald-400 font-bold text-sm">{formatCurrency(receita)}</span>
                </div>
              </div>

              {/* DESPESAS */}
              <div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Despesas</p>

                {metaAdsSpend !== null && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleCat('__marketing__')}
                      className="w-full flex items-center justify-between py-2 hover:bg-zinc-800/40 rounded-lg px-2 -mx-2 transition-colors"
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
                    <span className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(lucro)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-300 text-sm">Margem</span>
                    <span className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>{margem.toFixed(1).replace('.', ',')}%</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── DISTRIBUIÇÃO DE LUCRO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <Users className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Distribuição do Lucro — {formatMesLabel(mes)}</h3>
          </div>
          <div className="space-y-3">
            {[
              { nome: 'Francisco', pct: 45.5 },
              { nome: 'Renan',     pct: 45.5 },
              { nome: 'Felipe',    pct: 5.0  },
              { nome: 'Marcelo',   pct: 4.0  },
            ].map(({ nome, pct }) => {
              const valor = lucro * (pct / 100)
              return (
                <div key={nome} className="flex items-center gap-4">
                  <span className="text-zinc-300 text-sm w-20 shrink-0">{nome}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isPositive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-zinc-500 text-xs w-10 text-right shrink-0">{pct}%</span>
                  <span className={`font-semibold text-sm w-28 text-right shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(valor)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── CONCILIAÇÃO BANCÁRIA OFX ── */}
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
              <input ref={fileInputRef} type="file" accept=".ofx,.OFX" onChange={handleOFXUpload} className="hidden" />
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
                  <span className="text-white font-semibold">{ofxTxs.length}</span> transações de <span className="text-white font-semibold">{formatMesLabel(mes)}</span>
                  {ofxParaConciliar > 0 && <span className="text-emerald-400"> · {ofxParaConciliar} serão lançadas</span>}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setOfxTxs([]); setOfxCats({}); setOfxDescricoes({}) }} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
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
              <p className="text-zinc-600 text-xs mt-1">Importe um arquivo .OFX do seu banco para fazer a conciliação de {formatMesLabel(mes)}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
