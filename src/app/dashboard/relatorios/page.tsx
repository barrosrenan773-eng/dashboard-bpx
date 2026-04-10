'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { KPI_LABELS } from '@/lib/calculos'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  DollarSign, TrendingUp, TrendingDown, Briefcase,
  Percent, FileText, Hash, AlertTriangle, ArrowRight,
  BarChart2, Lock, Unlock, CheckCircle2, Download,
  X, RefreshCw, Clock, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contrato {
  id: string; nome: string; capital: number; taxa: number
  status: 'ativo' | 'finalizado' | 'aguardando'; created_at: string
  valor_total_contrato?: number; responsavel?: string; servico?: string
}
interface Despesa {
  id: string; descricao: string; categoria: string; valor: number; mes: string; created_at: string
}
interface Closure {
  id: string; mes_referencia: string; data_fechamento: string | null; status: 'open' | 'closed'
  receita_total: number; despesas_totais: number; lucro_liquido: number; margem: number
  contratos_total: number; contratos_finalizados: number; contratos_pendentes: number
  capital_total: number; capital_disponivel: number; capital_em_operacao: number; capital_travado: number
  distribuicao_lucro: { nome: string; percentual: number; valor: number }[]
  snapshot_completo: Record<string, unknown>; criado_em: string
}
interface CarryoverItem {
  id: string; mes_origem: string; mes_destino: string; tipo: string
  referencia_id: string | null; valor: number; descricao: string; status: string
}
type PeriodoKey = '7d' | '30d' | '90d' | 'mes' | 'custom'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISODate(d: Date) { return d.toISOString().split('T')[0] }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function getMonthKey(s: string) { return s.slice(0, 7) }
function mesLabel(iso: string) {
  const [y, m] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}
function fmtMes(m: string) {
  const [y, mo] = m.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[Number(mo) - 1]}/${y}`
}
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl text-xs space-y-1">
      <p className="text-zinc-400 font-medium mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, color, colorClass, bgClass }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; colorClass: string; bgClass: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgClass}`}><Icon className={`w-3.5 h-3.5 ${colorClass}`} /></div>
      </div>
      <p className="text-white font-bold text-2xl leading-tight">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1 truncate">{sub}</p>}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  ativo:      'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  finalizado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  aguardando: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
}

// ─── Confirm Fechamento Modal ─────────────────────────────────────────────────

function ConfirmFechamentoModal({
  closure, carryover, onConfirm, onCancel, loading,
}: {
  closure: Closure; carryover: CarryoverItem[]; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  const lucroPos = closure.lucro_liquido >= 0
  const pendentesDoMes = carryover.filter(c => c.mes_destino !== closure.mes_referencia)
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Fechar {fmtMes(closure.mes_referencia)}</h3>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Resumo do Mês</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Receita',    v: fmt(closure.receita_total),   c: 'text-emerald-400' },
                { l: 'Despesas',   v: fmt(closure.despesas_totais),  c: 'text-red-400' },
                { l: 'Lucro',      v: fmt(closure.lucro_liquido),    c: lucroPos ? 'text-violet-400' : 'text-red-400' },
                { l: 'Margem',     v: `${closure.margem.toFixed(1)}%`, c: lucroPos ? 'text-emerald-400' : 'text-red-400' },
                { l: 'Capital',    v: fmt(closure.capital_total),    c: 'text-blue-400' },
                { l: 'Contratos',  v: `${closure.contratos_total}`,  c: 'text-white' },
              ].map(k => (
                <div key={k.l}><p className="text-zinc-500 text-xs">{k.l}</p><p className={`font-semibold ${k.c}`}>{k.v}</p></div>
              ))}
            </div>
          </div>
          {closure.contratos_pendentes > 0 && (
            <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-400 text-sm font-medium">{closure.contratos_pendentes} contrato(s) pendente(s)</p>
                <p className="text-zinc-500 text-xs mt-0.5">Serão transportados automaticamente para o próximo mês.</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl p-4">
            <Lock className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 text-sm font-medium">Ação irreversível</p>
              <p className="text-zinc-500 text-xs mt-0.5">O snapshot será congelado. Nenhum dado poderá ser alterado diretamente.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-zinc-800">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Fechando...' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Snapshot Modal ───────────────────────────────────────────────────────────

function SnapshotModal({ closure, onClose }: { closure: Closure; onClose: () => void }) {
  const snap = closure.snapshot_completo as {
    contratos?: { lista?: { nome: string; servico: string; capital: number; taxa: number; status: string }[] }
  }

  function exportCSV() {
    const rows = [
      ['Mês', closure.mes_referencia],
      ['Receita', closure.receita_total],
      ['Despesas', closure.despesas_totais],
      ['Lucro', closure.lucro_liquido],
      ['Margem %', closure.margem],
      ['Capital Total', closure.capital_total],
      ['Contratos Total', closure.contratos_total],
      ['Finalizados', closure.contratos_finalizados],
      ['Pendentes', closure.contratos_pendentes],
      [],
      ['Distribuição de Lucro'],
      ...closure.distribuicao_lucro.map(d => [d.nome, `${d.percentual}%`, d.valor]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `fechamento-${closure.mes_referencia}.csv`; a.click()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-semibold">Snapshot — {fmtMes(closure.mes_referencia)}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Imutável</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Receita',  v: fmt(closure.receita_total),   c: 'text-emerald-400' },
              { l: 'Despesas', v: fmt(closure.despesas_totais),  c: 'text-red-400' },
              { l: 'Lucro',    v: fmt(closure.lucro_liquido),    c: closure.lucro_liquido >= 0 ? 'text-violet-400' : 'text-red-400' },
              { l: 'Margem',   v: `${closure.margem.toFixed(1)}%`, c: 'text-blue-400' },
            ].map(k => (
              <div key={k.l} className="bg-zinc-800 rounded-xl p-3">
                <p className="text-zinc-500 text-xs">{k.l}</p>
                <p className={`font-bold text-lg ${k.c}`}>{k.v}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Capital</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { l: 'Total',       v: fmt(closure.capital_total) },
                { l: 'Disponível',  v: fmt(closure.capital_disponivel) },
                { l: 'Em Operação', v: fmt(closure.capital_em_operacao) },
                { l: 'Travado',     v: fmt(closure.capital_travado) },
              ].map(k => (
                <div key={k.l} className="bg-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">{k.l}</p>
                  <p className="text-white font-semibold">{k.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Distribuição de Lucro</p>
            <div className="space-y-2">
              {closure.distribuicao_lucro.map(d => (
                <div key={d.nome} className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2.5">
                  <span className="text-white text-sm font-medium">{d.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 text-sm">{d.percentual}%</span>
                    <span className="text-emerald-400 font-semibold text-sm">{fmt(d.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {snap?.contratos?.lista && snap.contratos.lista.length > 0 && (
            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                Contratos ({snap.contratos.lista.length})
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {snap.contratos.lista.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-white text-xs font-medium">{c.nome}</span>
                      <span className="text-zinc-500 text-xs ml-2">{c.servico}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-400 text-xs">{fmt(c.capital)}</span>
                      <span className="text-emerald-400 text-xs">{fmt(c.taxa)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        c.status === 'finalizado' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                        c.status === 'ativo'      ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
                        'text-amber-400 bg-amber-400/10 border-amber-400/20'
                      }`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const today = new Date()

  // ── Dados operacionais ──
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [despesas, setDespesas]   = useState<Despesa[]>([])
  const [loading, setLoading]     = useState(true)

  // ── Fechamentos ──
  const [closures, setClosures]       = useState<Closure[]>([])
  const [carryover, setCarryover]     = useState<CarryoverItem[]>([])
  const [mesAtual, setMesAtual]       = useState('')
  const [loadingFech, setLoadingFech] = useState(true)
  const [confirmando, setConfirmando] = useState<Closure | null>(null)
  const [fechando, setFechando]       = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState<Closure | null>(null)
  const [successMsg, setSuccessMsg]   = useState('')

  // ── Mês selecionado (despesas mensais) ──
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  function navMes(delta: number) {
    const [y, m] = mesSelecionado.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMesSelecionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── Filtros ──
  const [periodo, setPeriodo]         = useState<PeriodoKey>('mes')
  const [customStart, setCustomStart] = useState(toISODate(startOfMonth(today)))
  const [customEnd, setCustomEnd]     = useState(toISODate(today))
  const [showCustom, setShowCustom]   = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')

  const loadOperacional = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, dRes] = await Promise.all([fetch('/api/contratos'), fetch('/api/despesas')])
      setContratos(cRes.ok ? (await cRes.json()) : [])
      setDespesas(dRes.ok ? (await dRes.json()) : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const loadFechamentos = useCallback(async () => {
    setLoadingFech(true)
    try {
      const res  = await fetch('/api/fechamento')
      const json = await res.json()
      setClosures(json.closures || [])
      setCarryover(json.carryover || [])
      setMesAtual(json.mesAtual || '')
    } catch { /* silent */ }
    finally { setLoadingFech(false) }
  }, [])

  useEffect(() => { loadOperacional(); loadFechamentos() }, [loadOperacional, loadFechamentos])

  // ── Date range ──
  const { dateStart, dateEnd } = useMemo(() => {
    if (periodo === '7d')  return { dateStart: addDays(today, -7),  dateEnd: today }
    if (periodo === '30d') return { dateStart: addDays(today, -30), dateEnd: today }
    if (periodo === '90d') return { dateStart: addDays(today, -90), dateEnd: today }
    if (periodo === 'mes') return { dateStart: startOfMonth(today), dateEnd: today }
    return {
      dateStart: customStart ? new Date(customStart + 'T00:00:00') : startOfMonth(today),
      dateEnd:   customEnd   ? new Date(customEnd   + 'T23:59:59') : today,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, customStart, customEnd])

  // Todos os contratos do período (para tabela/exibição)
  const contratosFiltrados = useMemo(() => contratos.filter(c => {
    const dt = new Date(c.created_at)
    return dt >= dateStart && dt <= dateEnd && (statusFiltro === 'todos' || c.status === statusFiltro)
  }), [contratos, dateStart, dateEnd, statusFiltro])

  // Apenas finalizados do período → alimentam KPIs de receita, capital, produção, lucro
  const contratosFinalizados = useMemo(() => contratos.filter(c => {
    const dt = new Date(c.created_at)
    return dt >= dateStart && dt <= dateEnd && c.status === 'finalizado'
  }), [contratos, dateStart, dateEnd])

  // Pipeline: aguardando no período
  const contratosAguardando = useMemo(() => contratos.filter(c => {
    const dt = new Date(c.created_at)
    return dt >= dateStart && dt <= dateEnd && c.status === 'aguardando'
  }), [contratos, dateStart, dateEnd])

  const despesasFiltradas = useMemo(() => despesas.filter(d => {
    if (d.categoria === 'compra_divida' || d.categoria === 'pl') return false
    if (d.mes) {
      const [y, m] = d.mes.split('-').map(Number)
      const dt = new Date(y, m - 1, 1)
      const startMes = new Date(dateStart.getFullYear(), dateStart.getMonth(), 1)
      const endMes = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), 1)
      return dt >= startMes && dt <= endMes
    }
    const dt = new Date(d.created_at)
    return dt >= dateStart && dt <= dateEnd
  }), [despesas, dateStart, dateEnd])

  // KPIs baseados apenas em contratos finalizados
  const totalCapital  = contratosFinalizados.reduce((s, c) => s + (c.capital ?? 0), 0)
  const totalReceita  = contratosFinalizados.reduce((s, c) => s + (c.taxa ?? 0), 0)
  const totalProducao = contratosFinalizados.reduce((s, c) => s + (c.valor_total_contrato ?? ((c.capital ?? 0) + (c.taxa ?? 0))), 0)
  const totalDespesas = despesasFiltradas.reduce((s, d) => s + (d.valor ?? 0), 0)
  const lucro         = totalReceita - totalDespesas
  const margem        = totalReceita > 0 ? (lucro / totalReceita) * 100 : 0
  const qtd           = contratosFinalizados.length
  const ticketMedio   = qtd > 0 ? totalReceita / qtd : 0
  const taxaMedia     = qtd > 0 ? totalReceita / qtd : 0

  // Pipeline metrics
  const pipelineCapital = contratosAguardando.reduce((s, c) => s + (c.capital ?? 0), 0)
  const pipelineTaxa    = contratosAguardando.reduce((s, c) => s + (c.taxa ?? 0), 0)

  // Gráfico histórico apenas com finalizados
  const chartData = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(m => {
      const mc = contratos.filter(c => getMonthKey(c.created_at) === m && c.status === 'finalizado')
      const md = despesas.filter(d => (d.mes === m || getMonthKey(d.created_at) === m) && d.categoria !== 'compra_divida' && d.categoria !== 'pl')
      const cap  = mc.reduce((s, c) => s + (c.capital ?? 0), 0)
      const taxa = mc.reduce((s, c) => s + (c.taxa ?? 0), 0)
      const desp = md.reduce((s, d) => s + (d.valor ?? 0), 0)
      const luc  = taxa - desp
      return { mes: mesLabel(m + '-01'), Receita: taxa, Capital: cap, Despesas: desp, Lucro: luc }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, despesas])

  // ── Despesas do mês selecionado por categoria ──
  const despesasMes = useMemo(() =>
    despesas.filter(d => d.mes === mesSelecionado || (d.created_at && d.created_at.startsWith(mesSelecionado)))
  , [despesas, mesSelecionado])

  const totalDespesasMes = despesasMes.reduce((s, d) => s + (d.valor ?? 0), 0)

  const catColors = ['#f97316','#3b82f6','#10b981','#8b5cf6','#ef4444','#06b6d4','#f59e0b','#ec4899','#84cc16','#6366f1']

  const despesasPorCat = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of despesasMes) {
      const cat = d.categoria || 'Outros'
      map[cat] = (map[cat] ?? 0) + (d.valor ?? 0)
    }
    return Object.entries(map)
      .map(([cat, val]) => ({ cat, val }))
      .sort((a, b) => b.val - a.val)
  }, [despesasMes])

  // ── Contratos finalizados do mês selecionado ──
  const contratosMes = useMemo(() =>
    contratos.filter(c => c.created_at && c.created_at.startsWith(mesSelecionado) && c.status === 'finalizado')
  , [contratos, mesSelecionado])

  const capitalMes = contratosMes.reduce((s, c) => s + (c.capital ?? 0), 0)
  const taxaMes    = contratosMes.reduce((s, c) => s + (c.taxa ?? 0), 0)
  const lucroMes   = taxaMes - totalDespesasMes
  const margemMes  = taxaMes > 0 ? (lucroMes / taxaMes) * 100 : 0

  const alertas: { msg: string; color: string; icon: React.ElementType }[] = []
  if (lucro < 0) alertas.push({ msg: `Lucro negativo no período: ${formatCurrency(lucro)}`, color: 'red', icon: TrendingDown })
  if (totalDespesas > totalReceita && totalReceita > 0) alertas.push({ msg: `Despesas superam a receita`, color: 'yellow', icon: AlertTriangle })
  if (margem > 0 && margem < 20) alertas.push({ msg: `Margem baixa: ${margem.toFixed(1)}% — meta > 20%`, color: 'yellow', icon: AlertTriangle })

  // ── Fechamento ──
  const closureAtual = closures.find(c => c.mes_referencia === mesAtual)
  const fechados     = closures.filter(c => c.status === 'closed').sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))

  const mesAnteriorStr = (() => {
    const [y, m] = mesAtual.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const mesAnteriorAberto = closures.find(c => c.mes_referencia === mesAnteriorStr && c.status === 'open')

  async function executarFechamento() {
    if (!confirmando) return
    setFechando(true)
    const res  = await fetch('/api/fechamento', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes_referencia: confirmando.mes_referencia }),
    })
    const json = await res.json()
    setFechando(false)
    setConfirmando(null)
    if (json.success) {
      setSuccessMsg(`${fmtMes(confirmando.mes_referencia)} fechado! ${json.carryover_gerado} pendência(s) transportada(s).`)
      setTimeout(() => setSuccessMsg(''), 5000)
      loadFechamentos()
    } else {
      alert('Erro: ' + json.error)
    }
  }

  const periodoOptions: { key: PeriodoKey; label: string }[] = [
    { key: '7d', label: '7d' }, { key: '30d', label: '30d' },
    { key: '90d', label: '90d' }, { key: 'mes', label: 'Este mês' },
    { key: 'custom', label: 'Personalizado' },
  ]
  const statusOptions = [
    { key: 'todos', label: 'Todos' }, { key: 'ativo', label: 'Ativo' },
    { key: 'finalizado', label: 'Finalizado' }, { key: 'aguardando', label: 'Aguardando' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Relatórios" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── Alerta mês anterior pendente ── */}
        {mesAnteriorAberto && (
          <div className="flex items-center gap-4 bg-amber-400/5 border border-amber-400/30 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-amber-400 font-medium text-sm">{fmtMes(mesAnteriorStr)} ainda não foi fechado</p>
              <p className="text-zinc-500 text-xs mt-0.5">Recomendamos fechar o mês anterior para manter o histórico consistente.</p>
            </div>
            <button onClick={() => setConfirmando(mesAnteriorAberto)}
              className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap">
              Fechar agora
            </button>
          </div>
        )}

        {/* ── Sucesso ── */}
        {successMsg && (
          <div className="flex items-center gap-3 bg-emerald-400/5 border border-emerald-400/30 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-400 text-sm">{successMsg}</p>
          </div>
        )}

        {/* ── FILTROS + BOTÃO FECHAR MÊS ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {periodoOptions.map(op => (
              <button key={op.key} onClick={() => { setPeriodo(op.key); setShowCustom(op.key === 'custom') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodo === op.key ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                {op.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {statusOptions.map(op => (
              <button key={op.key} onClick={() => setStatusFiltro(op.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFiltro === op.key ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                {op.label}
              </button>
            ))}
          </div>
          {showCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
              <span className="text-zinc-600 text-xs">até</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
            </div>
          )}
          {loading && <span className="text-zinc-500 text-xs animate-pulse">Carregando...</span>}

          {/* Botão Fechar Mês */}
          <div className="ml-auto">
            {closureAtual?.status === 'open' ? (
              <button onClick={() => setConfirmando(closureAtual)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors">
                <Lock className="w-4 h-4" />
                Fechar {fmtMes(mesAtual)}
              </button>
            ) : closureAtual?.status === 'closed' ? (
              <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {fmtMes(mesAtual)} fechado
              </span>
            ) : null}
          </div>
        </div>

        {/* ── ALERTAS ── */}
        {!loading && alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${a.color === 'red' ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                <a.icon className={`w-4 h-4 shrink-0 ${a.color === 'red' ? 'text-red-400' : 'text-yellow-400'}`} />
                <p className={`text-sm ${a.color === 'red' ? 'text-red-300' : 'text-yellow-300'}`}>{a.msg}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── KPI CARDS — CONTRATOS FINALIZADOS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Giro Total"      value={formatCurrency(totalProducao)} sub={`capital + taxa · ${qtd} finalizado${qtd !== 1 ? 's' : ''}`} icon={BarChart2}   color="#3B82F6" colorClass="text-blue-400"    bgClass="bg-blue-500/10" />
          <KpiCard label="Receita (Taxa da Operação)" value={formatCurrency(totalReceita)}  sub="campo Taxa — contratos finalizados"  icon={DollarSign}  color="#10B981" colorClass="text-emerald-400"  bgClass="bg-emerald-500/10" />
          <KpiCard label="Capital de Giro (Operação)" value={formatCurrency(totalCapital)}  sub="campo Capital — contratos finalizados" icon={Briefcase}   color="#F59E0B" colorClass="text-amber-400"   bgClass="bg-amber-500/10" />
          <KpiCard label={KPI_LABELS.despesasTotal} value={formatCurrency(totalDespesas)} sub={`${despesasFiltradas.length} lançamento${despesasFiltradas.length !== 1 ? 's' : ''} · aba Financeiro`} icon={TrendingDown} color="#EF4444" colorClass="text-red-400" bgClass="bg-red-500/10" />
          <KpiCard label={KPI_LABELS.lucro}         value={formatCurrency(lucro)}         sub="receita − despesas"       icon={lucro >= 0 ? TrendingUp : TrendingDown} color={lucro >= 0 ? '#10B981' : '#EF4444'} colorClass={lucro >= 0 ? 'text-emerald-400' : 'text-red-400'} bgClass={lucro >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} />
          <KpiCard label={KPI_LABELS.margem}        value={`${margem.toFixed(1).replace('.', ',')}%`} sub="lucro / receita" icon={Percent} color={margem >= 20 ? '#10B981' : margem >= 10 ? '#F59E0B' : '#EF4444'} colorClass={margem >= 20 ? 'text-emerald-400' : margem >= 10 ? 'text-amber-400' : 'text-red-400'} bgClass={margem >= 20 ? 'bg-emerald-500/10' : margem >= 10 ? 'bg-amber-500/10' : 'bg-red-500/10'} />
          <KpiCard label={KPI_LABELS.ticketMedio}   value={formatCurrency(ticketMedio)}   sub="produção / contratos"     icon={Hash}        color="#06B6D4" colorClass="text-cyan-400"    bgClass="bg-cyan-500/10" />
          <KpiCard label={KPI_LABELS.taxaMedia}     value={formatCurrency(taxaMedia)}     sub="receita / contratos"      icon={FileText}    color="#8B5CF6" colorClass="text-violet-400"  bgClass="bg-violet-500/10" />
        </div>

        {/* ── PIPELINE — CONTRATOS AGUARDANDO ── */}
        {contratosAguardando.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#EAB308' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-1.5 rounded-lg bg-yellow-500/10">
                <Clock className="w-3.5 h-3.5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Pipeline — Aguardando Liberação de Margem</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Capital em operação · não entra nos KPIs acima · aparece no Caixa como capital em operação</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs mb-1">Contratos</p>
                <p className="text-yellow-400 font-bold text-xl">{contratosAguardando.length}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs mb-1">Capital em Operação</p>
                <p className="text-blue-400 font-bold text-xl">{formatCurrency(pipelineCapital)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs mb-1">Taxa Potencial</p>
                <p className="text-emerald-400 font-bold text-xl">{formatCurrency(pipelineTaxa)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── RELATÓRIO DE DESPESAS MENSAL ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Header com navegador de mês */}
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">Despesas por Categoria — Mês</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Origem: tabela de despesas · Capital e Taxa: aba Contratos</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-white font-semibold text-sm min-w-[80px] text-center">{fmtMes(mesSelecionado)}</span>
              <button onClick={() => navMes(1)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* KPIs do mês */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Capital de Giro', value: fmt(capitalMes), color: 'text-amber-400', sub: `${contratosMes.length} contrato${contratosMes.length !== 1 ? 's' : ''}` },
                { label: 'Receita (Taxa)', value: fmt(taxaMes), color: 'text-emerald-400', sub: 'soma das taxas' },
                { label: 'Despesas', value: fmt(totalDespesasMes), color: 'text-red-400', sub: `${despesasMes.length} lançamento${despesasMes.length !== 1 ? 's' : ''}` },
                { label: 'Resultado', value: fmt(lucroMes), color: lucroMes >= 0 ? 'text-violet-400' : 'text-red-400', sub: `margem ${margemMes.toFixed(1)}%` },
              ].map(k => (
                <div key={k.label} className="bg-zinc-800/60 rounded-xl p-3.5">
                  <p className="text-zinc-500 text-xs mb-1">{k.label}</p>
                  <p className={`font-bold text-base ${k.color}`}>{k.value}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {despesasPorCat.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">Nenhuma despesa em {fmtMes(mesSelecionado)}</div>
            ) : (
              <>
                {/* Barra empilhada */}
                <div className="flex h-3 rounded-full overflow-hidden gap-px">
                  {despesasPorCat.map((item, i) => (
                    <div key={item.cat}
                      style={{ width: `${(item.val / totalDespesasMes) * 100}%`, backgroundColor: catColors[i % catColors.length] }}
                      title={`${item.cat}: ${fmt(item.val)}`}
                    />
                  ))}
                </div>

                {/* Categorias com barras proporcionais */}
                <div className="space-y-2">
                  {despesasPorCat.map((item, i) => {
                    const pct = totalDespesasMes > 0 ? (item.val / totalDespesasMes) * 100 : 0
                    const color = catColors[i % catColors.length]
                    const itens = despesasMes.filter(d => (d.categoria || 'Outros') === item.cat)
                    const isOpen = expandedCat === item.cat
                    return (
                      <div key={item.cat} className="rounded-xl overflow-hidden border border-zinc-800">
                        <button
                          onClick={() => setExpandedCat(isOpen ? null : item.cat)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-zinc-200 text-sm font-medium flex-1 text-left capitalize">{item.cat}</span>
                          <div className="flex-1 mx-3 bg-zinc-800 rounded-full h-1.5 hidden sm:block">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-zinc-500 text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                          <span className="text-white font-semibold text-sm w-28 text-right">{fmt(item.val)}</span>
                          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="border-t border-zinc-800 divide-y divide-zinc-800/60">
                            {itens.map(d => (
                              <div key={d.id} className="flex items-center justify-between px-4 py-2.5 bg-zinc-800/20">
                                <span className="text-zinc-400 text-xs truncate max-w-[60%]">{d.descricao || '—'}</span>
                                <span className="text-red-400 text-xs font-semibold">{fmt(d.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                  <span className="text-zinc-400 text-sm font-medium">Total de Despesas</span>
                  <span className="text-red-400 font-bold text-base">{fmt(totalDespesasMes)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── COMPOSIÇÃO DO RESULTADO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Composição do Resultado</h3>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Giro Total',  value: totalProducao, bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400' },
              { label: 'Capital de Giro',  value: totalCapital,  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400' },
              { label: 'Receita (Taxa)',   value: totalReceita,  bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',text: 'text-emerald-400' },
              { label: KPI_LABELS.despesas,  value: totalDespesas, bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400' },
              { label: KPI_LABELS.lucro,     value: lucro,         bg: lucro >= 0 ? 'bg-violet-500/10' : 'bg-red-500/10', border: lucro >= 0 ? 'border-violet-500/30' : 'border-red-500/30', text: lucro >= 0 ? 'text-violet-400' : 'text-red-400' },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`${item.bg} border ${item.border} rounded-xl px-4 py-3 text-center min-w-[110px]`}>
                  <p className="text-zinc-500 text-xs mb-1">{item.label}</p>
                  <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.value)}</p>
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* ── GRÁFICO EVOLUÇÃO 6 MESES ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Evolução Mensal — Últimos 6 Meses</h3>
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              {[['relGreen','#10B981'],['relBlue','#3B82F6'],['relRed','#EF4444'],['relViolet','#8B5CF6']].map(([id,c]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
          </svg>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 12 }} />
              <Area type="monotone" dataKey="Receita"  stroke="#10B981" strokeWidth={2} fill="url(#relGreen)"  dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
              <Area type="monotone" dataKey="Capital"  stroke="#3B82F6" strokeWidth={2} fill="url(#relBlue)"   dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
              <Area type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} fill="url(#relRed)"    dot={false} activeDot={{ r: 4, fill: '#EF4444' }} />
              <Area type="monotone" dataKey="Lucro"    stroke="#8B5CF6" strokeWidth={2} fill="url(#relViolet)" dot={false} activeDot={{ r: 4, fill: '#8B5CF6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── TABELA DE CONTRATOS ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Contratos no Período</h3>
            <span className="text-zinc-500 text-xs">{contratosFiltrados.length} registro{contratosFiltrados.length !== 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm animate-pulse">Carregando...</div>
          ) : contratosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">Nenhum contrato no período</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Cliente','Serviço','Capital','Taxa','Produção','Status','Data'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {contratosFiltrados.slice(0, 50).map(c => {
                    const prod = c.valor_total_contrato ?? (c.capital + c.taxa)
                    return (
                      <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 text-white font-medium text-sm truncate max-w-[140px]">{c.nome}</td>
                        <td className="py-3.5 px-4 text-zinc-400 text-sm">{c.servico || '—'}</td>
                        <td className="py-3.5 px-4 text-amber-400 font-semibold text-sm">{formatCurrency(c.capital)}</td>
                        <td className="py-3.5 px-4 text-emerald-400 font-semibold text-sm">{formatCurrency(c.taxa)}</td>
                        <td className="py-3.5 px-4 text-blue-400 font-semibold text-sm">{formatCurrency(prod)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[c.status] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-500 text-xs whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── TABELA DE DESPESAS ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Despesas no Período</h3>
            <span className="text-zinc-500 text-xs">{despesasFiltradas.length} registro{despesasFiltradas.length !== 1 ? 's' : ''}</span>
          </div>
          {despesasFiltradas.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">Nenhuma despesa no período</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Categoria','Descrição','Valor','Mês'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {despesasFiltradas.slice(0, 30).map(d => (
                    <tr key={d.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-zinc-300 text-sm capitalize">{d.categoria}</td>
                      <td className="py-3.5 px-4 text-zinc-400 text-sm truncate max-w-[200px]">{d.descricao}</td>
                      <td className="py-3.5 px-4 text-red-400 font-semibold text-sm">{formatCurrency(d.valor)}</td>
                      <td className="py-3.5 px-4 text-zinc-500 text-xs">{d.mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── HISTÓRICO DE FECHAMENTOS ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Histórico de Fechamentos</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Snapshots imutáveis — dados consolidados por mês</p>
              </div>
            </div>
            {loadingFech && <RefreshCw className="w-4 h-4 text-zinc-600 animate-spin" />}
          </div>

          {fechados.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm font-medium">Nenhum mês fechado ainda</p>
              <p className="text-zinc-600 text-xs mt-1">Use o botão "Fechar mês" para gerar o primeiro snapshot</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Mês</th>
                    <th className="text-left px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Fechado em</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Receita</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Despesas</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Lucro</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Margem</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Capital</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Contratos</th>
                    <th className="text-center px-5 py-3 text-zinc-500 text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {fechados.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Lock className="w-3.5 h-3.5 text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{fmtMes(c.mes_referencia)}</p>
                            <p className="text-zinc-600 text-xs">{c.mes_referencia}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-zinc-400 text-sm">
                          {c.data_fechamento
                            ? new Date(c.data_fechamento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-emerald-400 font-medium text-sm">{fmt(c.receita_total)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-red-400 text-sm">{fmt(c.despesas_totais)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`font-semibold text-sm ${c.lucro_liquido >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                          {fmt(c.lucro_liquido)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`text-sm font-medium ${c.margem >= 30 ? 'text-emerald-400' : c.margem >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                          {c.margem.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-blue-400 text-sm">{fmt(c.capital_total)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-zinc-300 text-sm">{c.contratos_total}</span>
                          {c.contratos_pendentes > 0 && (
                            <span className="text-xs text-amber-400">{c.contratos_pendentes} pend.</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-emerald-400/10 border-emerald-400/20 text-emerald-400">
                          <Lock className="w-3 h-3" /> Fechado
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSnapshotOpen(c)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ver relatório
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mês atual aberto */}
          {closureAtual?.status === 'open' && (
            <div className="mt-3 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Unlock className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{fmtMes(mesAtual)}</p>
                <p className="text-zinc-500 text-xs">Mês atual — em andamento</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-zinc-700/50 border-zinc-600 text-zinc-400">
                <Clock className="w-3 h-3" /> Aberto
              </span>
              <button onClick={() => setConfirmando(closureAtual)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors">
                <Lock className="w-3.5 h-3.5" /> Fechar mês
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Modals ── */}
      {confirmando && (
        <ConfirmFechamentoModal
          closure={confirmando} carryover={carryover}
          onConfirm={executarFechamento} onCancel={() => setConfirmando(null)} loading={fechando}
        />
      )}
      {snapshotOpen && (
        <SnapshotModal closure={snapshotOpen} onClose={() => setSnapshotOpen(null)} />
      )}
    </div>
  )
}
