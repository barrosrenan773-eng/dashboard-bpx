'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { KPI_LABELS } from '@/lib/calculos'
import { TrendingUp, TrendingDown, Minus, Maximize2, Minimize2, RefreshCw } from 'lucide-react'

export default function TVPage() {
  return <Suspense><TVContent /></Suspense>
}

const LOJAS = [
  { key: 'eros', label: 'BPX Eros' },
  { key: 'barba-negra', label: 'Barba Negra' },
  { key: 'farma', label: 'BPX Farma' },
]
const EXCLUIR_VENDEDORES = ['giulia azevedo', 'rayane - retenção', 'thiago mendonça', 'sem vendedor', 'adriane']
const titleCase = (s: string) => s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

function barColor(pct: number, ritmo: number) {
  if (pct >= ritmo) return 'bg-emerald-500'
  if (pct >= ritmo * 0.7) return 'bg-yellow-500'
  return 'bg-red-500'
}
function txtColor(pct: number, ritmo: number) {
  if (pct >= ritmo) return 'text-emerald-400'
  if (pct >= ritmo * 0.7) return 'text-yellow-400'
  return 'text-red-400'
}

function TVContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
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
  const [googleAdsSpend, setGoogleAdsSpend] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const daysInMonth = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0).getDate()
  const dayEnd = Math.min(parseInt(end.slice(8, 10)), daysInMonth)
  const ritmo = Math.round((dayEnd / daysInMonth) * 100)

  const loadData = useCallback(() => {
    setLoading(true)
    const lojasComMeta = LOJAS.filter(l => l.key !== 'farma')
    Promise.all([
      ...LOJAS.map(l => fetch(`/api/integrations/yampi-loja?loja=${l.key}&start=${start}&end=${end}`).then(r => r.json()).catch(() => ({}))),
      fetch(`/api/integrations/clint?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/metas-loja?mes=${mes}`).then(r => r.json()).catch(() => []),
      fetch(`/api/metas-vendedor?mes=${mes}`).then(r => r.json()).catch(() => []),
      ...lojasComMeta.map(l => fetch(`/api/integrations/meta?loja=${l.key}&start=${start}&end=${end}`).then(r => r.json()).catch(() => ({}))),
      fetch(`/api/integrations/meta-vendedores?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
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
      setMetaVend({ spend: Object.values(vendData.spendByVendedor || {}).reduce((s: number, v: any) => s + v, 0), spendByVendedor: vendData.spendByVendedor || {} })
      setLoading(false)
      setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    })
  }, [start, end, mes])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadData])

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const vendedores = ((clint?.vendedores || []) as any[])
    .filter((v: any) => !EXCLUIR_VENDEDORES.some(e => v.name?.toLowerCase().trim().includes(e)) && v.won > 0)
    .map((v: any) => {
      const meta = metasVendedores[v.name] || 0
      const pct = meta > 0 ? Math.round((v.revenue / meta) * 100) : 0
      const spend = metaVend.spendByVendedor[v.name] || metaVend.spendByVendedor[titleCase(v.name)] || 0
      return { ...v, meta, pct, spend }
    })
    .sort((a: any, b: any) => b.revenue - a.revenue)

  const totalRevVend = vendedores.reduce((s: number, v: any) => s + v.revenue, 0)
  const totalMetaVend = vendedores.reduce((s: number, v: any) => s + v.meta, 0)
  const pctVend = totalMetaVend > 0 ? Math.round((totalRevVend / totalMetaVend) * 100) : 0

  const lojas = LOJAS.map(l => ({
    ...l,
    revenue: lojasData[l.key]?.revenue || 0,
    meta: metasLojas[l.key] || 0,
    pct: (metasLojas[l.key] || 0) > 0 ? Math.round(((lojasData[l.key]?.revenue || 0) / metasLojas[l.key]) * 100) : 0,
    spend: metaSites[l.key]?.spend || 0,
  }))
  const totalRevLojas = lojas.reduce((s, l) => s + l.revenue, 0)
  const totalMetaLojas = lojas.reduce((s, l) => s + l.meta, 0)
  const pctLojas = totalMetaLojas > 0 ? Math.round((totalRevLojas / totalMetaLojas) * 100) : 0

  const totalRev = totalRevVend + totalRevLojas
  const totalMeta = totalMetaVend + totalMetaLojas
  const pctTotal = totalMeta > 0 ? Math.round((totalRev / totalMeta) * 100) : 0
  const totalSpend = metaVend.spend + lojas.reduce((s, l) => s + l.spend, 0)
  const roasTotal = totalSpend > 0 ? totalRev / totalSpend : 0

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-zinc-950 p-6 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-3xl tracking-tight">
            BPX<span className="text-emerald-400">.</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">{start} → {end} · ritmo esperado {ritmo}%</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-zinc-600 text-sm flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> {lastUpdate}
            </span>
          )}
          <button onClick={loadData} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen()
              const params = new URLSearchParams(searchParams.toString())
              params.delete('tv')
              router.push(`${pathname.replace('/tv', '')}?${params.toString()}`)
            }}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors text-xs font-medium"
          >
            Sair do modo TV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-xl">Carregando...</div>
      ) : (
        <>
          {/* KPIs gerais */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: KPI_LABELS.receitaTotal, value: formatCurrency(totalRev), sub: `${pctTotal}% da meta`, color: txtColor(pctTotal, ritmo) },
              { label: KPI_LABELS.metaTotal,   value: formatCurrency(totalMeta), sub: `esperado ${formatCurrency(totalMeta * ritmo / 100)}`, color: 'text-zinc-400' },
              { label: KPI_LABELS.gastTrafego, value: formatCurrency(totalSpend), sub: 'Meta Ads', color: 'text-orange-400' },
              { label: KPI_LABELS.roasGeral,   value: roasTotal > 0 ? `${roasTotal.toFixed(1)}x` : '—', sub: 'receita ÷ mídia', color: roasTotal >= 3 ? 'text-emerald-400' : roasTotal >= 1.5 ? 'text-yellow-400' : 'text-red-400' },
            ].map(k => (
              <div key={k.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <p className="text-zinc-500 text-sm uppercase tracking-wider mb-3">{k.label}</p>
                <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-zinc-600 text-sm mt-2">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Barra total */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-sm font-medium">Progresso Geral</span>
              <span className={`text-2xl font-bold ${txtColor(pctTotal, ritmo)}`}>{pctTotal}%</span>
            </div>
            <div className="relative h-4 bg-zinc-800 rounded-full">
              <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-zinc-500 z-10 rounded-full" style={{ left: `${Math.min(ritmo, 100)}%` }} />
              <div className={`h-full rounded-full transition-all ${barColor(pctTotal, ritmo)}`} style={{ width: `${Math.min(pctTotal, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-zinc-600 mt-2">
              <span>0%</span>
              <span>esperado hoje {ritmo}%</span>
              <span>meta 100%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 flex-1">
            {/* Vendedores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-xl">Vendedores</h2>
                <span className={`text-lg font-bold ${txtColor(pctVend, ritmo)}`}>{pctVend}% da meta</span>
              </div>
              <div className="relative h-2 bg-zinc-800 rounded-full">
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-zinc-500 z-10 rounded-full" style={{ left: `${Math.min(ritmo, 100)}%` }} />
                <div className={`h-full rounded-full ${barColor(pctVend, ritmo)}`} style={{ width: `${Math.min(pctVend, 100)}%` }} />
              </div>
              <div className="space-y-3 flex-1">
                {vendedores.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-3">
                    <span className="text-xl w-7 shrink-0">{medals[i] || ''}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold text-base truncate">{titleCase(v.name.split(' ')[0])}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-zinc-400 text-sm">{formatCurrency(v.revenue)}</span>
                          {v.meta > 0 && <span className={`text-sm font-bold ${txtColor(v.pct, ritmo)}`}>{v.pct}%</span>}
                        </div>
                      </div>
                      {v.meta > 0 && (
                        <div className="relative h-1.5 bg-zinc-800 rounded-full">
                          <div className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-zinc-500 z-10" style={{ left: `${Math.min(ritmo, 100)}%` }} />
                          <div className={`h-full rounded-full ${barColor(v.pct, ritmo)}`} style={{ width: `${Math.min(v.pct, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-zinc-800 flex justify-between text-sm">
                <span className="text-zinc-500">Total</span>
                <span className="text-white font-bold text-lg">{formatCurrency(totalRevVend)}</span>
              </div>
            </div>

            {/* Sites / Lojas */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-xl">Sites (E-commerce)</h2>
                <span className={`text-lg font-bold ${txtColor(pctLojas, ritmo)}`}>{pctLojas}% da meta</span>
              </div>
              <div className="relative h-2 bg-zinc-800 rounded-full">
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-zinc-500 z-10 rounded-full" style={{ left: `${Math.min(ritmo, 100)}%` }} />
                <div className={`h-full rounded-full ${barColor(pctLojas, ritmo)}`} style={{ width: `${Math.min(pctLojas, 100)}%` }} />
              </div>
              <div className="space-y-5 flex-1">
                {lojas.map((l, i) => (
                  <div key={l.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{medals[i] || ''}</span>
                        <span className="text-white font-semibold text-base">{l.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 text-sm">{formatCurrency(l.revenue)}</span>
                        {l.meta > 0 && <span className={`text-sm font-bold ${txtColor(l.pct, ritmo)}`}>{l.pct}%</span>}
                      </div>
                    </div>
                    {l.meta > 0 && (
                      <div className="relative h-1.5 bg-zinc-800 rounded-full">
                        <div className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-zinc-500 z-10" style={{ left: `${Math.min(ritmo, 100)}%` }} />
                        <div className={`h-full rounded-full ${barColor(l.pct, ritmo)}`} style={{ width: `${Math.min(l.pct, 100)}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-zinc-800 flex justify-between text-sm">
                <span className="text-zinc-500">Total</span>
                <span className="text-white font-bold text-lg">{formatCurrency(totalRevLojas)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
