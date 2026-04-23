'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  calcularKPIs,
  calcularHistoricoMensal,
  calcularDistribuicaoLucro,
  filtrarContratos,
  filtrarDespesas,
  startOfMonth,
  addDays,
  toISODate,
  KPI_LABELS,
  type Contrato,
  type Despesa,
} from '@/lib/calculos'
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
  Clock,
} from 'lucide-react'

type PeriodoKey = '7d' | '30d' | '90d' | 'mes' | 'custom'

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

export default function GeralPage() {
  const today = new Date()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [folhaPrevista, setFolhaPrevista] = useState(0)
  const [comissoesDoMes, setComissoesDoMes] = useState(0)
  const [receitasManuais, setReceitasManuais] = useState(0)
  const [metaAdsSpend, setMetaAdsSpend] = useState(0)

  const [periodo, setPeriodo] = useState<PeriodoKey>('mes')
  const [customStart, setCustomStart] = useState<string>(toISODate(startOfMonth(today)))
  const [customEnd, setCustomEnd] = useState<string>(toISODate(today))
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const mesMesAtual = new Date().toISOString().slice(0, 7)
        const [cRes, dRes, fRes, mRes, rRes, adRes] = await Promise.all([
          fetch('/api/contratos'),
          fetch('/api/despesas'),
          fetch(`/api/previsao-folha?mes=${mesMesAtual}`),
          fetch(`/api/metas-vendedor?mes=${mesMesAtual}`),
          fetch(`/api/receitas?mes=${mesMesAtual}`),
          fetch(`/api/meta-ads?mes=${mesMesAtual}`),
        ])
        const cData = cRes.ok ? await cRes.json() : []
        const dData = dRes.ok ? await dRes.json() : []
        setContratos(Array.isArray(cData) ? cData : [])
        setDespesas(Array.isArray(dData) ? dData : [])

        // Folha
        const fData = fRes.ok ? await fRes.json() : {}
        setFolhaPrevista(Number(fData?.valor) || 0)

        // Comissões
        const metasArr: { vendedor: string; meta: number }[] = mRes.ok ? await mRes.json() : []
        const metasMap: Record<string, number> = {}
        if (Array.isArray(metasArr)) metasArr.forEach(mv => { metasMap[mv.vendedor] = mv.meta })
        const doMes = (Array.isArray(cData) ? cData : []).filter((c: { status: string; data_finalizacao?: string | null; created_at: string }) => {
          if (c.status !== 'finalizado') return false
          const dr = c.data_finalizacao || c.created_at
          return dr?.slice(0, 7) === mesMesAtual
        })
        const taxaMap: Record<string, number> = {}
        for (const c of doMes) {
          const temDois = !!c.assistente && !!c.analista
          for (const nome of [c.assistente, c.analista]) {
            if (!nome) continue
            taxaMap[nome] = (taxaMap[nome] ?? 0) + (temDois ? c.taxa / 2 : c.taxa)
          }
        }
        let totalComissoes = 0
        for (const [nome, taxa] of Object.entries(taxaMap)) {
          const meta = metasMap[nome] ?? 0
          const pct = meta > 0 ? (taxa / meta) * 100 : 0
          const perc = pct < 70 ? 0 : pct < 81 ? 1.5 : pct < 91 ? 2 : pct < 131 ? 3 : pct < 150 ? 4 : 5
          totalComissoes += taxa * (perc / 100)
        }
        setComissoesDoMes(totalComissoes)

        // Receitas manuais
        const rData = rRes.ok ? await rRes.json() : []
        const totalRec = Array.isArray(rData) ? rData.reduce((s: number, r: { valor: number }) => s + (Number(r.valor) || 0), 0) : 0
        setReceitasManuais(totalRec)

        // Meta Ads
        const adData = adRes.ok ? await adRes.json() : {}
        setMetaAdsSpend(Number(adData?.spend) || 0)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const { dateStart, dateEnd } = useMemo(() => {
    if (periodo === '7d') return { dateStart: addDays(today, -7), dateEnd: today }
    if (periodo === '30d') return { dateStart: addDays(today, -30), dateEnd: today }
    if (periodo === '90d') return { dateStart: addDays(today, -90), dateEnd: today }
    if (periodo === 'mes') return { dateStart: startOfMonth(today), dateEnd: today }
    return {
      dateStart: customStart ? new Date(customStart + 'T00:00:00') : startOfMonth(today),
      dateEnd: customEnd ? new Date(customEnd + 'T23:59:59') : today,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, customStart, customEnd])

  // Contratos finalizados → alimentam KPIs (receita, capital, produção, lucro)
  const contratosFinalizados = useMemo(
    () => filtrarContratos(contratos, dateStart, dateEnd, 'finalizado'),
    [contratos, dateStart, dateEnd]
  )

  // Contratos aguardando → pipeline (capital em operação)
  const contratosAguardando = useMemo(
    () => filtrarContratos(contratos, dateStart, dateEnd, 'aguardando'),
    [contratos, dateStart, dateEnd]
  )

  // Todos os contratos do período → apenas para exibição na tabela
  const contratosPeriodo = useMemo(
    () => filtrarContratos(contratos, dateStart, dateEnd, 'todos'),
    [contratos, dateStart, dateEnd]
  )

  const despesasFiltradas = useMemo(
    () => filtrarDespesas(despesas, dateStart, dateEnd),
    [despesas, dateStart, dateEnd]
  )

  // KPIs: receita/lucro/margem dos finalizados, capital e producao de todos do período
  const kpisBase = useMemo(() => {
    const base = calcularKPIs(contratosFinalizados, despesasFiltradas)
    const capitalTotal = contratosPeriodo.reduce((s, c) => s + (Number(c.capital) || 0), 0)
    const producaoTotal = contratosPeriodo.reduce((s, c) => {
      const prod = (c as any).valor_total_contrato ?? ((Number(c.capital) || 0) + (Number(c.taxa) || 0))
      return s + prod
    }, 0)
    return { ...base, capital: capitalTotal, producao: producaoTotal }
  }, [contratosFinalizados, contratosPeriodo, despesasFiltradas])

  // Comissão Francisco HSF = 5% do lucro líquido CCA2 (antes da comissão)
  const comissaoFrancisco = useMemo(() => {
    if (periodo !== 'mes') return 0
    const receitaCCA2 = contratosFinalizados
      .filter(c => (c as any).origem === 'CCA2')
      .reduce((s, c) => s + (c.taxa ?? 0), 0)
    const despesasCCA2 = despesasFiltradas
      .filter(d => (d as any).empresa === 'CCA2')
      .reduce((s, d) => s + Number(d.valor), 0)
    const lucroBrutoCCA2 = receitaCCA2 - despesasCCA2
    return Math.max(0, lucroBrutoCCA2) * 0.05
  }, [contratosFinalizados, despesasFiltradas, periodo])

  // Adiciona folha + comissões + metaAds às despesas, receitas manuais à receita
  const kpis = useMemo(() => {
    if (periodo !== 'mes') return kpisBase
    const extraDespesas = folhaPrevista + comissoesDoMes + metaAdsSpend + comissaoFrancisco
    const receita = kpisBase.receita + receitasManuais
    const lucro = receita - kpisBase.despesas - extraDespesas
    return {
      ...kpisBase,
      receita,
      despesas: kpisBase.despesas + extraDespesas,
      lucro,
      margem: receita > 0 ? (lucro / receita) * 100 : 0,
    }
  }, [kpisBase, periodo, folhaPrevista, comissoesDoMes, metaAdsSpend, receitasManuais, comissaoFrancisco])

  // Pipeline: contratos aguardando liberação de margem
  const pipeline = useMemo(() => ({
    qtd: contratosAguardando.length,
    capital: contratosAguardando.reduce((s, c) => s + (c.capital ?? 0), 0),
    taxa: contratosAguardando.reduce((s, c) => s + (c.taxa ?? 0), 0),
  }), [contratosAguardando])

  // Histórico mensal apenas com contratos finalizados
  const contratosFinalizadosTodos = useMemo(
    () => contratos.filter(c => c.status === 'finalizado'),
    [contratos]
  )

  const chartData = useMemo(
    () => calcularHistoricoMensal(contratosFinalizadosTodos, despesas, 6),
    [contratosFinalizadosTodos, despesas]
  )

  const distribuicao = useMemo(
    () => calcularDistribuicaoLucro(kpis.lucro),
    [kpis.lucro]
  )

  // Produção por pessoa (assistente/analista) — baseado em contratos finalizados do período
  const resumoPessoas = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number; taxa: number }> = {}
    for (const c of contratosFinalizados) {
      const temDois = !!c.assistente && !!c.analista
      for (const nome of [c.assistente, c.analista]) {
        if (!nome) continue
        if (!map[nome]) map[nome] = { nome, qtd: 0, taxa: 0 }
        map[nome].qtd++
        map[nome].taxa += temDois ? c.taxa / 2 : c.taxa
      }
    }
    return Object.values(map).sort((a, b) => b.taxa - a.taxa)
  }, [contratosFinalizados])

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

  const statusColor: Record<string, string> = {
    finalizado: 'text-emerald-400 bg-emerald-500/10',
    aguardando: 'text-yellow-400 bg-yellow-500/10',
  }

  const statusLabel: Record<string, string> = {
    finalizado: 'Finalizado',
    aguardando: 'Aguardando margem',
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Visão Geral" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── FILTRO DE PERÍODO ── */}
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

          <span className="text-zinc-600 text-xs">
            KPIs baseados em <span className="text-emerald-400 font-medium">{kpis.qtdContratos} contrato{kpis.qtdContratos !== 1 ? 's' : ''} finalizado{kpis.qtdContratos !== 1 ? 's' : ''}</span>
            {pipeline.qtd > 0 && <> · <span className="text-yellow-400 font-medium">{pipeline.qtd} em pipeline</span></>}
          </span>

          {loading && (
            <span className="text-zinc-500 text-xs animate-pulse">Carregando...</span>
          )}
        </div>

        {/* ── ALERTAS ── */}
        {!loading && (kpis.despesas > kpis.receita && kpis.receita > 0 || kpis.lucro < 0) && (
          <div className="space-y-2">
            {kpis.despesas > kpis.receita && kpis.receita > 0 && (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-yellow-300 text-sm">
                  Atenção: as despesas ({formatCurrency(kpis.despesas)}) superam a receita ({formatCurrency(kpis.receita)}) no período selecionado.
                </p>
              </div>
            )}
            {kpis.lucro < 0 && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">
                  Lucro negativo no período: {formatCurrency(kpis.lucro)}. Revise despesas ou aumente a receita.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── KPI CARDS — CONTRATOS FINALIZADOS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label={KPI_LABELS.producao}
            value={formatCurrency(kpis.producao)}
            sub={`capital + taxa · ${kpis.qtdContratos} finalizado${kpis.qtdContratos !== 1 ? 's' : ''}`}
            icon={BarChart2}
            color="#3B82F6"
            colorClass="text-blue-400"
            bgClass="bg-blue-500/10"
          />
          <KpiCard
            label={KPI_LABELS.receitaTotal}
            value={formatCurrency(kpis.receita)}
            sub="soma das taxas (contratos finalizados)"
            icon={DollarSign}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label={KPI_LABELS.capital}
            value={formatCurrency(kpis.capital)}
            sub="capital retornado (contratos finalizados)"
            icon={Briefcase}
            color="#F59E0B"
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
          />
          <KpiCard
            label={KPI_LABELS.despesas}
            value={formatCurrency(kpis.despesas)}
            sub={`${despesasFiltradas.length} lançamento${despesasFiltradas.length !== 1 ? 's' : ''} · Financeiro`}
            icon={TrendingDown}
            color="#EF4444"
            colorClass="text-red-400"
            bgClass="bg-red-500/10"
          />
          <KpiCard
            label={KPI_LABELS.lucro}
            value={formatCurrency(kpis.lucro)}
            sub="receita - despesas"
            icon={kpis.lucro >= 0 ? TrendingUp : TrendingDown}
            color={kpis.lucro >= 0 ? '#10B981' : '#EF4444'}
            colorClass={kpis.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}
            bgClass={kpis.lucro >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
          <KpiCard
            label={KPI_LABELS.qtdContratos}
            value={String(kpis.qtdContratos)}
            sub="contratos finalizados no período"
            icon={FileText}
            color="#8B5CF6"
            colorClass="text-violet-400"
            bgClass="bg-violet-500/10"
          />
          <KpiCard
            label={KPI_LABELS.ticketMedio}
            value={formatCurrency(kpis.ticketMedio)}
            sub="produção / qtd contratos"
            icon={Hash}
            color="#06B6D4"
            colorClass="text-cyan-400"
            bgClass="bg-cyan-500/10"
          />
          <KpiCard
            label={KPI_LABELS.taxaMedia}
            value={formatCurrency(kpis.taxaMedia)}
            sub="receita / qtd contratos"
            icon={Percent}
            color="#F97316"
            colorClass="text-orange-400"
            bgClass="bg-orange-500/10"
          />
        </div>

        {/* ── PIPELINE — CONTRATOS AGUARDANDO ── */}
        {pipeline.qtd > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#EAB308' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-1.5 rounded-lg bg-yellow-500/10">
                <Clock className="w-3.5 h-3.5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Pipeline — Aguardando Liberação de Margem</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Capital em operação · ainda não retornou ao caixa · não entra nos KPIs acima</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs mb-1">Contratos</p>
                <p className="text-yellow-400 font-bold text-xl">{pipeline.qtd}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs mb-1">Capital em Operação</p>
                <p className="text-blue-400 font-bold text-xl">{formatCurrency(pipeline.capital)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-zinc-500 text-xs mb-1">Taxa Potencial</p>
                <p className="text-emerald-400 font-bold text-xl">{formatCurrency(pipeline.taxa)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── ESTRUTURA FINANCEIRA ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Estrutura Financeira — Contratos Finalizados</h3>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: KPI_LABELS.producao, value: kpis.producao, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
              { label: KPI_LABELS.capital, value: kpis.capital, bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
              { label: KPI_LABELS.receita, value: kpis.receita, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
              { label: KPI_LABELS.despesas, value: kpis.despesas, bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
              {
                label: KPI_LABELS.lucro, value: kpis.lucro,
                bg: kpis.lucro >= 0 ? 'bg-violet-500/10' : 'bg-red-500/10',
                border: kpis.lucro >= 0 ? 'border-violet-500/30' : 'border-red-500/30',
                text: kpis.lucro >= 0 ? 'text-violet-400' : 'text-red-400',
              },
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

        {/* ── GRÁFICO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-1">Evolução Mensal — Últimos 6 Meses</h3>
          <p className="text-zinc-500 text-xs mb-5">Baseado em contratos finalizados + despesas lançadas no Financeiro</p>

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
              <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 12 }} />
              <Area type="monotone" dataKey="Producao" name="Produção" stroke="#3B82F6" strokeWidth={2} fill="url(#gradBlue)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
              <Area type="monotone" dataKey="Receita" stroke="#10B981" strokeWidth={2} fill="url(#gradGreen)" dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
              <Area type="monotone" dataKey="Capital" stroke="#F59E0B" strokeWidth={2} fill="url(#gradAmber)" dot={false} activeDot={{ r: 4, fill: '#F59E0B' }} />
              <Area type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} fill="url(#gradRed)" dot={false} activeDot={{ r: 4, fill: '#EF4444' }} />
              <Area type="monotone" dataKey="Lucro" stroke="#8B5CF6" strokeWidth={2} fill="url(#gradViolet)" dot={false} activeDot={{ r: 4, fill: '#8B5CF6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── TABELAS ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">Contratos</h3>
                <p className="text-zinc-500 text-xs mt-0.5">{contratosPeriodo.length} no período · fonte: aba Contratos</p>
              </div>
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
                  {contratosPeriodo.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-zinc-600 py-8">
                        Nenhum contrato no período
                      </td>
                    </tr>
                  ) : (
                    contratosPeriodo.slice(0, 20).map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-white font-medium">{c.nome}</p>
                          {(c.telefone || c.cpf) && (
                            <p className="text-zinc-500 text-xs mt-0.5">
                              {c.telefone && <span>{c.telefone}</span>}
                              {c.telefone && c.cpf && <span className="mx-1">·</span>}
                              {c.cpf && <span>{c.cpf}</span>}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-400">{formatCurrency(Number(c.capital) || 0)}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(Number(c.taxa) || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] ?? 'text-zinc-400 bg-zinc-800'}`}>
                            {statusLabel[c.status] ?? c.status}
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

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-white font-semibold text-sm">Despesas por Categoria</h3>
              <p className="text-zinc-500 text-xs mt-0.5">{despesasFiltradas.length} lançamentos · fonte: aba Financeiro</p>
            </div>
            <div className="divide-y divide-zinc-800">
              {despesasFiltradas.length === 0 ? (
                <p className="text-center text-zinc-600 py-8 text-xs">Nenhuma despesa no período</p>
              ) : (
                (() => {
                  const LABELS: Record<string, string> = {
                    dept_pessoal: 'Departamento Pessoal', beneficios: 'Benefícios', comissao_corretor: 'Comissão Corretor',
                    comissao_gerente: 'Comissão Gerente', marketing: 'Marketing', servico_terceirizado: 'Serviço Terceirizado',
                    impostos: 'Impostos', taxas_bancarias: 'Taxas Bancárias', despesas_diversas: 'Despesas Diversas',
                    devolucao_emprestimo: 'Devolução Empréstimo', bonificacao: 'Bonificação',
                    fixa: 'Despesas Fixas', variavel: 'Despesas Variáveis', pix: 'Tarifas Pix', pessoal: 'Pessoal',
                  }
                  const byCat: Record<string, { total: number; items: Despesa[] }> = {}
                  for (const d of despesasFiltradas) {
                    if (!byCat[d.categoria]) byCat[d.categoria] = { total: 0, items: [] }
                    byCat[d.categoria].total += Number(d.valor) || 0
                    byCat[d.categoria].items.push(d)
                  }
                  return Object.entries(byCat)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([cat, { total, items }]) => (
                      <div key={cat} className="px-5 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-zinc-300 text-xs font-semibold">{LABELS[cat] || cat}</span>
                          <span className="text-red-400 text-xs font-bold">{formatCurrency(total)}</span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map(d => (
                            <div key={d.id} className="flex items-center justify-between">
                              <span className="text-zinc-500 text-xs truncate max-w-[200px]">{d.descricao || '—'}</span>
                              <span className="text-zinc-500 text-xs ml-2">{formatCurrency(Number(d.valor))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                })()
              )}
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
                  <p className="text-zinc-500 text-xs mt-0.5">Baseada no lucro líquido dos contratos finalizados no período</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs">Lucro do período</p>
                <p className={`font-bold text-sm ${kpis.lucro >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                  {formatCurrency(kpis.lucro)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {distribuicao.map(({ nome, percentual, valor }) => (
                <div key={nome} className="flex items-center gap-4">
                  <span className="text-zinc-300 text-sm w-20 shrink-0">{nome}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${kpis.lucro >= 0 ? 'bg-violet-500/70' : 'bg-red-500/70'}`}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                  <span className="text-zinc-500 text-xs w-10 text-right shrink-0">{percentual}%</span>
                  <span className={`font-semibold text-sm w-28 text-right shrink-0 ${kpis.lucro >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                    {formatCurrency(valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PRODUÇÃO POR PESSOA ── */}
        {resumoPessoas.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-white font-semibold text-sm">Produção por Pessoa</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Taxa proporcional dos contratos finalizados no período · 50% cada quando há assistente + analista</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-5 py-3 font-medium">Pessoa</th>
                    <th className="text-right px-4 py-3 font-medium">Contratos</th>
                    <th className="text-right px-5 py-3 font-medium">Taxa proporcional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {resumoPessoas.map(p => (
                    <tr key={p.nome} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{p.nome}</td>
                      <td className="px-4 py-3 text-right text-zinc-400">{p.qtd}</td>
                      <td className="px-5 py-3 text-right text-emerald-400 font-semibold">{formatCurrency(p.taxa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
