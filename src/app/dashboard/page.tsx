'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>
}

const LOJAS = [
  { key: 'eros', label: 'Damatta Eros' },
  { key: 'barba-negra', label: 'Barba Negra' },
  { key: 'farma', label: 'Damatta Farma' },
]

const EXCLUIR_VENDEDORES = ['giulia azevedo', 'rayane - retenção', 'thiago mendonça', 'sem vendedor', 'adriane']
const titleCase = (s: string) => s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

function pctColor(pct: number, ritmo: number) {
  if (pct >= ritmo) return 'text-emerald-400'
  if (pct >= ritmo * 0.7) return 'text-yellow-400'
  return 'text-red-400'
}

function barColor(pct: number, ritmo: number) {
  if (pct >= ritmo) return 'bg-emerald-500'
  if (pct >= ritmo * 0.7) return 'bg-yellow-500'
  return 'bg-red-500'
}

function StatusBadge({ pct, ritmo }: { pct: number; ritmo: number }) {
  if (pct >= ritmo) return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" /> No ritmo
    </span>
  )
  if (pct >= ritmo * 0.7) return (
    <span className="flex items-center gap-1 text-xs font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" /> Atenção
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3" /> Atrasado
    </span>
  )
}

function ProgressBar({ pct, ritmo }: { pct: number; ritmo: number }) {
  const filled = Math.min(pct, 100)
  return (
    <div className="relative h-1.5 bg-zinc-800 rounded-full mt-3">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-zinc-500 z-10"
        style={{ left: `${Math.min(ritmo, 100)}%` }}
        title={`Esperado: ${ritmo}%`}
      />
      <div className={`h-full rounded-full ${barColor(pct, ritmo)}`} style={{ width: `${filled}%` }} />
    </div>
  )
}

function SectionHeader({
  title, pct, ritmo, receita, meta, spend, roas
}: {
  title: string; pct: number; ritmo: number
  receita: number; meta: number; spend: number; roas: number
}) {
  const esperado = meta * (ritmo / 100)
  const diferenca = receita - esperado
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">{title}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          diferenca >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {diferenca >= 0 ? '▲' : '▼'} {diferenca >= 0 ? '+' : ''}{formatCurrency(diferenca)} vs esperado
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 rounded-xl overflow-hidden mb-4">
        {[
          {
            label: 'Esperado até hoje',
            value: formatCurrency(esperado),
            sub: `${ritmo}% de ${formatCurrency(meta)}`,
            color: 'text-white',
          },
          {
            label: 'Realizado',
            value: formatCurrency(receita),
            sub: `${pct}% da meta`,
            color: pctColor(pct, ritmo),
          },
          {
            label: 'Gasto em tráfego',
            value: spend > 0 ? formatCurrency(spend) : '—',
            sub: 'Meta Ads',
            color: 'text-white',
          },
          {
            label: 'ROAS',
            value: roas > 0 ? `${roas.toFixed(1)}x` : '—',
            sub: 'receita ÷ gasto mídia',
            color: 'text-white',
          },
        ].map(k => (
          <div key={k.label} className="bg-zinc-900 px-5 py-4">
            <p className="text-zinc-600 text-xs mb-2">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-zinc-700 text-xs mt-1">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-600 mb-1.5">
        <span>0%</span>
        <span className="text-zinc-500">esperado {ritmo}%</span>
        <span>meta 100%</span>
      </div>
      <div className="relative h-2 bg-zinc-800 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-zinc-500 z-10"
          style={{ left: `${Math.min(ritmo, 100)}%` }}
        />
        <div
          className={`h-full rounded-full ${barColor(pct, ritmo)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today
  const mes = start.slice(0, 7)

  const [lojasData, setLojasData] = useState<Record<string, any>>({})
  const [metasLojas, setMetasLojas] = useState<Record<string, number>>({})
  const [clint, setClint] = useState<any>(null)
  const [metasVendedores, setMetasVendedores] = useState<Record<string, number>>({})
  const [metaSites, setMetaSites] = useState<Record<string, { spend: number; roas: number }>>({})
  const [metaVend, setMetaVend] = useState<{ spend: number; spendByVendedor: Record<string, number> }>({ spend: 0, spendByVendedor: {} })
  const [loading, setLoading] = useState(true)

  const daysInMonth = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0).getDate()
  const dayEnd = Math.min(parseInt(end.slice(8, 10)), daysInMonth)
  const ritmoEsperado = Math.round((dayEnd / daysInMonth) * 100)

  useEffect(() => {
    setLoading(true)
    const lojasComMeta = LOJAS.filter(l => l.key !== 'farma')
    Promise.all([
      ...LOJAS.map(l =>
        fetch(`/api/integrations/yampi-loja?loja=${l.key}&start=${start}&end=${end}`)
          .then(r => r.json()).catch(() => ({}))
      ),
      fetch(`/api/integrations/clint?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/metas-loja?mes=${mes}`).then(r => r.json()).catch(() => []),
      fetch(`/api/metas-vendedor?mes=${mes}`).then(r => r.json()).catch(() => []),
      ...lojasComMeta.map(l =>
        fetch(`/api/integrations/meta?loja=${l.key}&start=${start}&end=${end}`)
          .then(r => r.json()).catch(() => ({}))
      ),
      fetch(`/api/integrations/meta-vendedores?start=${start}&end=${end}`)
        .then(r => r.json()).catch(() => ({})),
    ]).then(results => {
      const lojas: Record<string, any> = {}
      LOJAS.forEach((l, i) => { lojas[l.key] = results[i] })
      setLojasData(lojas)
      setClint(results[LOJAS.length])

      const mLojas: Record<string, number> = {}
      ;(results[LOJAS.length + 1] as any[]).forEach((m: any) => { mLojas[m.vendedor] = m.meta })
      setMetasLojas(mLojas)

      const mVend: Record<string, number> = {}
      ;(results[LOJAS.length + 2] as any[]).forEach((m: any) => { mVend[m.vendedor] = m.meta })
      setMetasVendedores(mVend)

      const metaSitesMap: Record<string, { spend: number; roas: number }> = {}
      lojasComMeta.forEach((l, i) => {
        const d = results[LOJAS.length + 3 + i] || {}
        metaSitesMap[l.key] = { spend: d.spend || 0, roas: d.roas || 0 }
      })
      setMetaSites(metaSitesMap)

      const vendData = results[LOJAS.length + 3 + lojasComMeta.length] || {}
      setMetaVend({
        spend: Object.values(vendData.spendByVendedor || {}).reduce((s: number, v: any) => s + v, 0),
        spendByVendedor: vendData.spendByVendedor || {},
      })

      setLoading(false)
    })
  }, [start, end, mes])

  const vendedores: any[] = ((clint?.vendedores || []) as any[])
    .filter((v: any) => !EXCLUIR_VENDEDORES.some(e => v.name?.toLowerCase().trim().includes(e)) && v.won > 0)
    .map((v: any) => {
      const meta = metasVendedores[v.name] || 0
      const pct = meta > 0 ? Math.round((v.revenue / meta) * 100) : 0
      const spend = metaVend.spendByVendedor[v.name] || 0
      const roas = spend > 0 ? v.revenue / spend : 0
      return { ...v, meta, pct, spend, roas }
    })
    .sort((a: any, b: any) => b.pct - a.pct)

  const totalRevVend = vendedores.reduce((s: number, v: any) => s + v.revenue, 0)
  const totalMetaVend = vendedores.reduce((s: number, v: any) => s + v.meta, 0)
  const totalPctVend = totalMetaVend > 0 ? Math.round((totalRevVend / totalMetaVend) * 100) : 0
  const roasVend = metaVend.spend > 0 ? totalRevVend / metaVend.spend : 0

  const lojasComMetaData = LOJAS.map(l => {
    const revenue = lojasData[l.key]?.revenue || 0
    const meta = metasLojas[l.key] || 0
    const pct = meta > 0 ? Math.round((revenue / meta) * 100) : 0
    const spend = metaSites[l.key]?.spend || 0
    const roas = metaSites[l.key]?.roas || 0
    return { ...l, revenue, meta, pct, spend, roas }
  })
  const totalRevLojas = lojasComMetaData.reduce((s, l) => s + l.revenue, 0)
  const totalMetaLojas = lojasComMetaData.reduce((s, l) => s + l.meta, 0)
  const totalPctLojas = totalMetaLojas > 0 ? Math.round((totalRevLojas / totalMetaLojas) * 100) : 0
  const totalSpendLojas = lojasComMetaData.reduce((s, l) => s + l.spend, 0)
  const roasLojas = totalSpendLojas > 0 ? totalRevLojas / totalSpendLojas : 0

  // Resumo geral consolidado
  const receitaTotal = totalRevVend + totalRevLojas
  const metaTotal = totalMetaVend + totalMetaLojas
  const esperadoHoje = metaTotal * (ritmoEsperado / 100)
  const diferenca = receitaTotal - esperadoHoje
  const pctTotal = metaTotal > 0 ? Math.round((receitaTotal / metaTotal) * 100) : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Visão Geral" lastSync={loading ? 'carregando...' : 'agora mesmo'} />

      <div className="p-6 space-y-10">

        {/* ──── RESUMO GERAL ──── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

          {/* Linha de status */}
          <div className={`h-1 w-full ${barColor(pctTotal, ritmoEsperado)}`} />

          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                Dia {dayEnd} de {daysInMonth} · Meta do mês: {formatCurrency(metaTotal)}
              </p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                diferenca >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {diferenca >= 0 ? '▲' : '▼'} {diferenca >= 0 ? '+' : ''}{formatCurrency(diferenca)} vs esperado
              </span>
            </div>

            {/* 4 KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 rounded-xl overflow-hidden">
              {[
                {
                  label: 'Receita no período',
                  value: formatCurrency(receitaTotal),
                  sub: `${pctTotal}% da meta`,
                  color: pctColor(pctTotal, ritmoEsperado),
                },
                {
                  label: 'Esperado até hoje',
                  value: formatCurrency(esperadoHoje),
                  sub: `${ritmoEsperado}% proporcional`,
                  color: 'text-white',
                },
                {
                  label: 'Gasto em tráfego',
                  value: formatCurrency(metaVend.spend + totalSpendLojas),
                  sub: 'Meta Ads (todos)',
                  color: 'text-white',
                },
                {
                  label: 'ROAS geral',
                  value: (metaVend.spend + totalSpendLojas) > 0
                    ? `${(receitaTotal / (metaVend.spend + totalSpendLojas)).toFixed(1)}x`
                    : '—',
                  sub: 'receita ÷ gasto mídia',
                  color: 'text-white',
                },
              ].map(k => (
                <div key={k.label} className="bg-zinc-900 px-5 py-4">
                  <p className="text-zinc-600 text-xs mb-2">{k.label}</p>
                  {loading
                    ? <div className="h-7 w-28 bg-zinc-800 rounded animate-pulse" />
                    : <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  }
                  <p className="text-zinc-700 text-xs mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Barra de progresso */}
            {!loading && metaTotal > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-zinc-600 mb-1.5">
                  <span>0%</span>
                  <span className="text-zinc-500">esperado {ritmoEsperado}%</span>
                  <span>meta 100%</span>
                </div>
                <div className="relative h-2.5 bg-zinc-800 rounded-full">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-px h-5 bg-zinc-500 z-10"
                    style={{ left: `${Math.min(ritmoEsperado, 100)}%` }}
                  />
                  <div
                    className={`h-full rounded-full transition-all ${barColor(pctTotal, ritmoEsperado)}`}
                    style={{ width: `${Math.min(pctTotal, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ──── VENDEDORES ──── */}
        <section>
          <SectionHeader
            title="Vendedores"
            pct={totalPctVend}
            ritmo={ritmoEsperado}
            receita={totalRevVend}
            meta={totalMetaVend}
            spend={metaVend.spend}
            roas={roasVend}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading
              ? Array(6).fill(0).map((_, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse h-28" />
                ))
              : vendedores.map((v: any) => (
                  <div key={v.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                    {/* Linha topo: nome + badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-white text-sm font-semibold truncate">{titleCase(v.name)}</span>
                      <StatusBadge pct={v.pct} ritmo={ritmoEsperado} />
                    </div>

                    {/* Valores */}
                    <div className="flex items-baseline justify-between">
                      <span className={`text-2xl font-bold ${pctColor(v.pct, ritmoEsperado)}`}>{v.pct}%</span>
                      <span className="text-zinc-400 text-sm">{formatCurrency(v.revenue)}</span>
                    </div>

                    {/* Barra */}
                    <ProgressBar pct={v.pct} ritmo={ritmoEsperado} />

                    {/* Meta + mídia */}
                    <div className="flex items-center justify-between mt-2.5 text-xs text-zinc-600">
                      <span>meta {formatCurrency(v.meta)}</span>
                      {v.spend > 0 && (
                        <span>
                          mídia {formatCurrency(v.spend)}
                          {v.roas > 0 && <span className="ml-1 text-zinc-700">· {v.roas.toFixed(1)}x</span>}
                        </span>
                      )}
                    </div>
                  </div>
                ))
            }
          </div>

          {!loading && vendedores.length === 0 && (
            <p className="text-zinc-600 text-sm">Nenhum vendedor com metas configuradas.</p>
          )}
        </section>

        {/* Divisor */}
        <div className="border-t border-zinc-800" />

        {/* ──── SITES ──── */}
        <section>
          <SectionHeader
            title="Sites"
            pct={totalPctLojas}
            ritmo={ritmoEsperado}
            receita={totalRevLojas}
            meta={totalMetaLojas}
            spend={totalSpendLojas}
            roas={roasLojas}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {loading
              ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse h-28" />
                ))
              : lojasComMetaData.map(l => (
                  <div key={l.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-white text-sm font-semibold">{l.label}</span>
                      <StatusBadge pct={l.pct} ritmo={ritmoEsperado} />
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className={`text-2xl font-bold ${pctColor(l.pct, ritmoEsperado)}`}>{l.pct}%</span>
                      <span className="text-zinc-400 text-sm">{formatCurrency(l.revenue)}</span>
                    </div>

                    <ProgressBar pct={l.pct} ritmo={ritmoEsperado} />

                    <div className="flex items-center justify-between mt-2.5 text-xs text-zinc-600">
                      <span>meta {formatCurrency(l.meta)}</span>
                      {l.spend > 0 && (
                        <span>
                          mídia {formatCurrency(l.spend)}
                          {l.roas > 0 && <span className="ml-1 text-zinc-700">· {l.roas.toFixed(1)}x</span>}
                        </span>
                      )}
                    </div>
                  </div>
                ))
            }
          </div>
        </section>

      </div>
    </div>
  )
}
