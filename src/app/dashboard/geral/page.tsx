'use client'

import { useEffect, useState, useMemo } from 'react'
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  FileText,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Hash,
  Percent,
  Users,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contrato {
  id: string
  nome: string
  capital: number
  taxa: number
  status: 'ativo' | 'finalizado' | 'aguardando'
  created_at: string
  valor_total_contrato?: number
  responsavel?: string
  origem?: string
}

interface Despesa {
  id: string
  descricao: string
  categoria: string
  valor: number
  mes: string
  created_at: string
}

type PeriodoKey = '7d' | '30d' | '90d' | 'mes' | 'custom'
type StatusKey = 'todos' | 'ativo' | 'finalizado' | 'aguardando'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function mesLabel(isoDate: string): string {
  const [y, m] = isoDate.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  })
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

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
    <div className={`bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5`} style={{ borderTopColor: color }}>
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

export default function GeralPage() {
  const today = new Date()

  // ── State ──
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)

  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [statusFiltro, setStatusFiltro] = useState<StatusKey>('todos')
  const [customStart, setCustomStart] = useState<string>(toISODate(startOfMonth(today)))
  const [customEnd, setCustomEnd] = useState<string>(toISODate(today))
  const [showCustom, setShowCustom] = useState(false)

  // ── Fetch ──
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/contratos'),
          fetch('/api/despesas'),
        ])
        const cData = cRes.ok ? await cRes.json() : []
        const dData = dRes.ok ? await dRes.json() : []
        setContratos(Array.isArray(cData) ? cData : [])
        setDespesas(Array.isArray(dData) ? dData : [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Date range ──
  const { dateStart, dateEnd } = useMemo(() => {
    if (periodo === '7d') return { dateStart: addDays(today, -7), dateEnd: today }
    if (periodo === '30d') return { dateStart: addDays(today, -30), dateEnd: today }
    if (periodo === '90d') return { dateStart: addDays(today, -90), dateEnd: today }
    if (periodo === 'mes') return { dateStart: startOfMonth(today), dateEnd: today }
    // custom
    return {
      dateStart: customStart ? new Date(customStart + 'T00:00:00') : startOfMonth(today),
      dateEnd: customEnd ? new Date(customEnd + 'T23:59:59') : today,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, customStart, customEnd])

  // ── Filter contratos ──
  const contratosFiltrados = useMemo(() => {
    return contratos.filter((c) => {
      const dt = new Date(c.created_at)
      const inPeriod = dt >= dateStart && dt <= dateEnd
      const inStatus = statusFiltro === 'todos' || c.status === statusFiltro
      return inPeriod && inStatus
    })
  }, [contratos, dateStart, dateEnd, statusFiltro])

  // ── Filter despesas ──
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const dt = new Date(d.created_at)
      return dt >= dateStart && dt <= dateEnd
    })
  }, [despesas, dateStart, dateEnd])

  // ── KPI values ──
  const totalCapital = contratosFiltrados.reduce((s, c) => s + (c.capital ?? 0), 0)
  const totalTaxa = contratosFiltrados.reduce((s, c) => s + (c.taxa ?? 0), 0)
  const totalProducao = contratosFiltrados.reduce((s, c) => {
    if (c.valor_total_contrato) return s + c.valor_total_contrato
    return s + (c.capital ?? 0) + (c.taxa ?? 0)
  }, 0)
  const totalDespesas = despesasFiltradas.reduce((s, d) => s + (d.valor ?? 0), 0)
  const lucro = totalTaxa - totalDespesas
  const qtd = contratosFiltrados.length
  const ticketMedio = qtd > 0 ? totalProducao / qtd : 0
  const taxaMedia = qtd > 0 ? totalTaxa / qtd : 0

  // ── Monthly chart data (last 6 months) ──
  const chartData = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map((m) => {
      const mc = contratos.filter((c) => getMonthKey(c.created_at) === m)
      const md = despesas.filter((d) => d.mes === m || getMonthKey(d.created_at) === m)
      const cap = mc.reduce((s, c) => s + (c.capital ?? 0), 0)
      const taxa = mc.reduce((s, c) => s + (c.taxa ?? 0), 0)
      const prod = mc.reduce((s, c) => {
        if (c.valor_total_contrato) return s + c.valor_total_contrato
        return s + (c.capital ?? 0) + (c.taxa ?? 0)
      }, 0)
      const desp = md.reduce((s, d) => s + (d.valor ?? 0), 0)
      return {
        mes: mesLabel(m + '-01'),
        Produção: prod,
        Receita: taxa,
        Capital: cap,
        Despesas: desp,
        Lucro: taxa - desp,
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, despesas])

  // ── Handle periodo buttons ──
  const handlePeriodo = (p: PeriodoKey) => {
    setPeriodo(p)
    setShowCustom(p === 'custom')
  }

  const periodoOptions: { key: PeriodoKey; label: string }[] = [
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
    { key: 'mes', label: 'Este mês' },
    { key: 'custom', label: 'Personalizado' },
  ]

  const statusOptions: { key: StatusKey; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'ativo', label: 'Ativo' },
    { key: 'finalizado', label: 'Finalizado' },
    { key: 'aguardando', label: 'Aguardando' },
  ]

  const statusColor: Record<string, string> = {
    ativo: 'text-emerald-400 bg-emerald-500/10',
    finalizado: 'text-blue-400 bg-blue-500/10',
    aguardando: 'text-yellow-400 bg-yellow-500/10',
  }

  // ── Alerts ──
  const alertDespMaiorReceita = totalDespesas > totalTaxa && totalTaxa > 0
  const alertLucroNegativo = lucro < 0

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Visão Geral" lastSync={`Atualizado agora`} />

      <div className="p-6 space-y-6">

        {/* ── FILTROS ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {periodoOptions.map((op) => (
              <button
                key={op.key}
                onClick={() => handlePeriodo(op.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodo === op.key
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {statusOptions.map((op) => (
              <button
                key={op.key}
                onClick={() => setStatusFiltro(op.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFiltro === op.key
                    ? 'bg-zinc-700 text-white shadow'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          {showCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
              />
              <span className="text-zinc-600 text-xs">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {loading && (
            <span className="text-zinc-500 text-xs animate-pulse">Carregando...</span>
          )}
        </div>

        {/* ── ALERTAS ── */}
        {!loading && (alertDespMaiorReceita || alertLucroNegativo) && (
          <div className="space-y-2">
            {alertDespMaiorReceita && (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-yellow-300 text-sm">
                  Atenção: as despesas ({formatCurrency(totalDespesas)}) superam a receita ({formatCurrency(totalTaxa)}) no período selecionado.
                </p>
              </div>
            )}
            {alertLucroNegativo && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">
                  Lucro negativo no período: {formatCurrency(lucro)}. Revise despesas ou aumente a receita.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── KPI CARDS — 4 colunas x 2 linhas ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label="Produção Total"
            value={formatCurrency(totalProducao)}
            sub={`capital + taxa de ${qtd} contrato${qtd !== 1 ? 's' : ''}`}
            icon={BarChart2}
            color="#3B82F6"
            colorClass="text-blue-400"
            bgClass="bg-blue-500/10"
          />
          <KpiCard
            label="Receita Total"
            value={formatCurrency(totalTaxa)}
            sub="soma das taxas (lucro bruto)"
            icon={DollarSign}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label="Capital Utilizado"
            value={formatCurrency(totalCapital)}
            sub="capital empregado (não é despesa)"
            icon={Briefcase}
            color="#F59E0B"
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
          />
          <KpiCard
            label="Despesas"
            value={formatCurrency(totalDespesas)}
            sub={`${despesasFiltradas.length} lançamento${despesasFiltradas.length !== 1 ? 's' : ''}`}
            icon={TrendingDown}
            color="#EF4444"
            colorClass="text-red-400"
            bgClass="bg-red-500/10"
          />
          <KpiCard
            label="Lucro Líquido"
            value={formatCurrency(lucro)}
            sub={`receita - despesas`}
            icon={lucro >= 0 ? TrendingUp : TrendingDown}
            color={lucro >= 0 ? '#10B981' : '#EF4444'}
            colorClass={lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}
            bgClass={lucro >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
          <KpiCard
            label="Qtd Contratos"
            value={String(qtd)}
            sub={`no período selecionado`}
            icon={FileText}
            color="#8B5CF6"
            colorClass="text-violet-400"
            bgClass="bg-violet-500/10"
          />
          <KpiCard
            label="Ticket Médio"
            value={formatCurrency(ticketMedio)}
            sub="produção / qtd contratos"
            icon={Hash}
            color="#06B6D4"
            colorClass="text-cyan-400"
            bgClass="bg-cyan-500/10"
          />
          <KpiCard
            label="Taxa Média"
            value={formatCurrency(taxaMedia)}
            sub="receita / qtd contratos"
            icon={Percent}
            color="#F97316"
            colorClass="text-orange-400"
            bgClass="bg-orange-500/10"
          />
        </div>

        {/* ── ESTRUTURA FINANCEIRA (waterfall) ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Estrutura Financeira</h3>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Produção', value: totalProducao, color: '#3B82F6', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
              { label: 'Capital', value: totalCapital, color: '#F59E0B', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
              { label: 'Receita', value: totalTaxa, color: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
              { label: 'Despesas', value: totalDespesas, color: '#EF4444', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
              { label: 'Lucro', value: lucro, color: lucro >= 0 ? '#8B5CF6' : '#EF4444', bg: lucro >= 0 ? 'bg-violet-500/10' : 'bg-red-500/10', border: lucro >= 0 ? 'border-violet-500/30' : 'border-red-500/30', text: lucro >= 0 ? 'text-violet-400' : 'text-red-400' },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`${item.bg} border ${item.border} rounded-xl px-4 py-3 text-center min-w-[120px]`}>
                  <p className="text-zinc-500 text-xs mb-1">{item.label}</p>
                  <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.value)}</p>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── GRÁFICOS ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Evolução Mensal — Últimos 6 Meses</h3>

          {/* Definir gradientes SVG */}
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>

          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 12 }}
              />
              <Area
                type="monotone"
                dataKey="Produção"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#gradBlue)"
                dot={false}
                activeDot={{ r: 4, fill: '#3B82F6' }}
              />
              <Area
                type="monotone"
                dataKey="Receita"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#gradGreen)"
                dot={false}
                activeDot={{ r: 4, fill: '#10B981' }}
              />
              <Area
                type="monotone"
                dataKey="Capital"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#gradAmber)"
                dot={false}
                activeDot={{ r: 4, fill: '#F59E0B' }}
              />
              <Area
                type="monotone"
                dataKey="Despesas"
                stroke="#EF4444"
                strokeWidth={2}
                fill="url(#gradRed)"
                dot={false}
                activeDot={{ r: 4, fill: '#EF4444' }}
              />
              <Area
                type="monotone"
                dataKey="Lucro"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill="url(#gradViolet)"
                dot={false}
                activeDot={{ r: 4, fill: '#8B5CF6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── TABELAS — grid 2 colunas ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Tabela Contratos */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Contratos</h3>
              <span className="text-zinc-500 text-xs">{contratosFiltrados.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Cliente</th>
                    <th className="text-right px-4 py-3 font-medium">Capital</th>
                    <th className="text-right px-4 py-3 font-medium">Taxa</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {contratosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-zinc-600 py-8">
                        Nenhum contrato no período
                      </td>
                    </tr>
                  ) : (
                    contratosFiltrados.slice(0, 20).map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3 text-white font-medium truncate max-w-[140px]">{c.nome}</td>
                        <td className="px-4 py-3 text-right text-amber-400">{formatCurrency(c.capital ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(c.taxa ?? 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] ?? 'text-zinc-400 bg-zinc-800'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-zinc-400">
                          {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela Despesas */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Despesas</h3>
              <span className="text-zinc-500 text-xs">{despesasFiltradas.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Categoria</th>
                    <th className="text-left px-4 py-3 font-medium">Descrição</th>
                    <th className="text-right px-4 py-3 font-medium">Valor</th>
                    <th className="text-right px-5 py-3 font-medium">Mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {despesasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-zinc-600 py-8">
                        Nenhuma despesa no período
                      </td>
                    </tr>
                  ) : (
                    despesasFiltradas.slice(0, 20).map((d) => (
                      <tr key={d.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3 text-zinc-300 capitalize">{d.categoria}</td>
                        <td className="px-4 py-3 text-zinc-400 truncate max-w-[140px]">{d.descricao}</td>
                        <td className="px-4 py-3 text-right text-red-400 font-medium">{formatCurrency(d.valor ?? 0)}</td>
                        <td className="px-5 py-3 text-right text-zinc-500">{d.mes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── DISTRIBUIÇÃO DE LUCROS ── */}
        {!loading && (
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#8B5CF6' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Users className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Distribuição de Lucros</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Baseada no lucro líquido do período selecionado</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs">Lucro do período</p>
                <p className={`font-bold text-sm ${lucro >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                  {formatCurrency(lucro)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { nome: 'Francisco', pct: 45.5 },
                { nome: 'Renan',     pct: 45.5 },
                { nome: 'Felipe',    pct: 5.0  },
                { nome: 'Marcelo',   pct: 4.0  },
              ].map(({ nome, pct }) => {
                const valor = lucro * (pct / 100)
                const isPos = lucro >= 0
                return (
                  <div key={nome} className="flex items-center gap-4">
                    <span className="text-zinc-300 text-sm w-20 shrink-0">{nome}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${isPos ? 'bg-violet-500/70' : 'bg-red-500/70'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-zinc-500 text-xs w-10 text-right shrink-0">{pct}%</span>
                    <span className={`font-semibold text-sm w-28 text-right shrink-0 ${isPos ? 'text-violet-400' : 'text-red-400'}`}>
                      {formatCurrency(valor)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
