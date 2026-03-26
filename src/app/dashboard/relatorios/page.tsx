'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  DollarSign, TrendingUp, TrendingDown, Briefcase,
  Percent, FileText, Hash, AlertTriangle, ArrowRight,
  BarChart2,
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
  servico?: string
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISODate(d: Date): string { return d.toISOString().split('T')[0] }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function getMonthKey(s: string): string { return s.slice(0, 7) }
function mesLabel(iso: string): string {
  const [y, m] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
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
      {payload.map(p => (
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
  label, value, sub, icon: Icon, color, colorClass, bgClass,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; colorClass: string; bgClass: string
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

const STATUS_STYLE: Record<string, string> = {
  ativo:      'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  finalizado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  aguardando: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const today = new Date()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)

  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [customStart, setCustomStart] = useState(toISODate(startOfMonth(today)))
  const [customEnd, setCustomEnd] = useState(toISODate(today))
  const [showCustom, setShowCustom] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [cRes, dRes] = await Promise.all([fetch('/api/contratos'), fetch('/api/despesas')])
        const cData = cRes.ok ? await cRes.json() : []
        const dData = dRes.ok ? await dRes.json() : []
        setContratos(Array.isArray(cData) ? cData : [])
        setDespesas(Array.isArray(dData) ? dData : [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

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

  // ── Filtered data ──
  const contratosFiltrados = useMemo(() => contratos.filter(c => {
    const dt = new Date(c.created_at)
    const inPeriod = dt >= dateStart && dt <= dateEnd
    const inStatus = statusFiltro === 'todos' || c.status === statusFiltro
    return inPeriod && inStatus
  }), [contratos, dateStart, dateEnd, statusFiltro])

  const despesasFiltradas = useMemo(() => despesas.filter(d => {
    const dt = new Date(d.created_at)
    return dt >= dateStart && dt <= dateEnd
  }), [despesas, dateStart, dateEnd])

  // ── KPIs ──
  const totalCapital   = contratosFiltrados.reduce((s, c) => s + (c.capital ?? 0), 0)
  const totalReceita   = contratosFiltrados.reduce((s, c) => s + (c.taxa ?? 0), 0)
  const totalProducao  = contratosFiltrados.reduce((s, c) => s + (c.valor_total_contrato ?? (c.capital ?? 0) + (c.taxa ?? 0)), 0)
  const totalDespesas  = despesasFiltradas.reduce((s, d) => s + (d.valor ?? 0), 0)
  const lucro          = totalReceita - totalDespesas
  const margem         = totalReceita > 0 ? (lucro / totalReceita) * 100 : 0
  const qtd            = contratosFiltrados.length
  const ticketMedio    = qtd > 0 ? totalProducao / qtd : 0
  const taxaMedia      = qtd > 0 ? totalReceita / qtd : 0

  // ── Chart — 6 months ──
  const chartData = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(m => {
      const mc = contratos.filter(c => getMonthKey(c.created_at) === m)
      const md = despesas.filter(d => d.mes === m || getMonthKey(d.created_at) === m)
      const cap  = mc.reduce((s, c) => s + (c.capital ?? 0), 0)
      const taxa = mc.reduce((s, c) => s + (c.taxa ?? 0), 0)
      const desp = md.reduce((s, d) => s + (d.valor ?? 0), 0)
      const luc  = taxa - desp
      const mar  = taxa > 0 ? (luc / taxa) * 100 : 0
      return { mes: mesLabel(m + '-01'), Receita: taxa, Capital: cap, Despesas: desp, Lucro: luc, Margem: mar }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratos, despesas])

  // ── Alerts ──
  const alertas: { msg: string; color: string; icon: React.ElementType }[] = []
  if (lucro < 0)                              alertas.push({ msg: `Lucro negativo no período: ${formatCurrency(lucro)}`, color: 'red', icon: TrendingDown })
  if (totalDespesas > totalReceita && totalReceita > 0) alertas.push({ msg: `Despesas (${formatCurrency(totalDespesas)}) superam a receita (${formatCurrency(totalReceita)})`, color: 'yellow', icon: AlertTriangle })
  if (margem > 0 && margem < 20)              alertas.push({ msg: `Margem baixa: ${margem.toFixed(1)}% — meta sugerida > 20%`, color: 'yellow', icon: AlertTriangle })

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

        {/* ── FILTROS ── */}
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

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Produção Total" value={formatCurrency(totalProducao)} sub={`capital + taxa · ${qtd} contrato${qtd !== 1 ? 's' : ''}`} icon={BarChart2} color="#3B82F6" colorClass="text-blue-400" bgClass="bg-blue-500/10" />
          <KpiCard label="Receita Total" value={formatCurrency(totalReceita)} sub="soma das taxas cobradas" icon={DollarSign} color="#10B981" colorClass="text-emerald-400" bgClass="bg-emerald-500/10" />
          <KpiCard label="Capital Utilizado" value={formatCurrency(totalCapital)} sub="capital empregado" icon={Briefcase} color="#F59E0B" colorClass="text-amber-400" bgClass="bg-amber-500/10" />
          <KpiCard label="Total Despesas" value={formatCurrency(totalDespesas)} sub={`${despesasFiltradas.length} lançamento${despesasFiltradas.length !== 1 ? 's' : ''}`} icon={TrendingDown} color="#EF4444" colorClass="text-red-400" bgClass="bg-red-500/10" />
          <KpiCard label="Lucro Líquido" value={formatCurrency(lucro)} sub="receita − despesas" icon={lucro >= 0 ? TrendingUp : TrendingDown} color={lucro >= 0 ? '#10B981' : '#EF4444'} colorClass={lucro >= 0 ? 'text-emerald-400' : 'text-red-400'} bgClass={lucro >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'} />
          <KpiCard label="Margem" value={`${margem.toFixed(1).replace('.', ',')}%`} sub="lucro / receita" icon={Percent} color={margem >= 20 ? '#10B981' : margem >= 10 ? '#F59E0B' : '#EF4444'} colorClass={margem >= 20 ? 'text-emerald-400' : margem >= 10 ? 'text-amber-400' : 'text-red-400'} bgClass={margem >= 20 ? 'bg-emerald-500/10' : margem >= 10 ? 'bg-amber-500/10' : 'bg-red-500/10'} />
          <KpiCard label="Ticket Médio" value={formatCurrency(ticketMedio)} sub="produção / contratos" icon={Hash} color="#06B6D4" colorClass="text-cyan-400" bgClass="bg-cyan-500/10" />
          <KpiCard label="Taxa Média" value={formatCurrency(taxaMedia)} sub="receita / contratos" icon={FileText} color="#8B5CF6" colorClass="text-violet-400" bgClass="bg-violet-500/10" />
        </div>

        {/* ── COMPOSIÇÃO DO RESULTADO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Composição do Resultado</h3>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Produção', value: totalProducao, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
              { label: 'Capital', value: totalCapital, bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
              { label: 'Receita', value: totalReceita, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
              { label: 'Despesas', value: totalDespesas, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
              { label: 'Lucro', value: lucro, bg: lucro >= 0 ? 'bg-violet-500/10' : 'bg-red-500/10', border: lucro >= 0 ? 'border-violet-500/30' : 'border-red-500/30', text: lucro >= 0 ? 'text-violet-400' : 'text-red-400' },
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
              {[['relGreen','#10B981'],['relBlue','#3B82F6'],['relRed','#EF4444'],['relViolet','#8B5CF6'],['relAmber','#F59E0B']].map(([id,c]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.3} />
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
            <div className="p-8 text-center text-zinc-600 text-sm">Nenhum contrato no período selecionado</div>
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

      </div>
    </div>
  )
}
