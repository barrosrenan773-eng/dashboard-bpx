'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const LOJAS: Record<string, { label: string; cor: string }> = {
  'eros': { label: 'BPX Eros', cor: 'emerald' },
  'barba-negra': { label: 'Barba Negra', cor: 'blue' },
  'farma': { label: 'BPX Farma', cor: 'purple' },
}

const CANAL_PT: Record<string, string> = {
  'Organic Search': 'Busca Orgânica',
  'Paid Search': 'Busca Paga',
  'Organic Social': 'Social Orgânico',
  'Paid Social': 'Social Pago',
  'Direct': 'Direto',
  'Referral': 'Referência',
  'Email': 'E-mail',
  'Display': 'Display',
  'Affiliates': 'Afiliados',
  'Unassigned': 'Não atribuído',
  'Unknown': 'Desconhecido',
  'Cross-network': 'Performance Max',
  'SMS': 'SMS',
  'Audio': 'Áudio',
}

export default function LojaDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const loja = params.loja as string
  const lojaInfo = LOJAS[loja] || { label: loja, cor: 'zinc' }

  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today
  const mes = start.slice(0, 7)

  const [ga4, setGa4] = useState<any>(null)
  const [yampi, setYampi] = useState<any>(null)
  const [metas, setMetas] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('carregando...')
  const [ga4Error, setGa4Error] = useState(false)
  const [yampiError, setYampiError] = useState(false)

  useEffect(() => {
    if (!loja) return

    Promise.all([
      fetch(`/api/integrations/ga4?loja=${loja}&start=${start}&end=${end}`)
        .then(r => r.json())
        .then(d => { if (d.error) { setGa4Error(true); return null } return d })
        .catch(() => { setGa4Error(true); return null }),
      fetch(`/api/integrations/yampi-loja?loja=${loja}&start=${start}&end=${end}`)
        .then(r => r.json())
        .then(d => { if (d.error) { setYampiError(true); return null } return d })
        .catch(() => { setYampiError(true); return null }),
      fetch(`/api/metas-loja?mes=${mes}`)
        .then(r => r.json())
        .catch(() => []),
    ]).then(([ga4Data, yampiData, metasData]) => {
      setGa4(ga4Data)
      setYampi(yampiData)
      const m = Array.isArray(metasData) ? metasData.find((x: any) => x.vendedor === loja) : null
      setMetas(m || null)
      setLastSync('agora mesmo')
      setLoading(false)
    })
  }, [loja, start, end, mes])

  // Métricas calculadas
  const activeUsers = ga4?.activeUsers ?? 0
  const bounceRate = ga4?.bounceRate ?? 0
  const conversionRate = ga4?.conversionRate ?? 0
  const revenue = yampi?.revenue ?? ga4?.purchaseRevenue ?? 0
  const orders = yampi?.orders ?? ga4?.purchases ?? 0
  const avgTicket = yampi?.avgTicket ?? (orders > 0 ? revenue / orders : 0)
  const revenuePerUser = activeUsers > 0 ? revenue / activeUsers : 0

  // Metas
  const metaConversao: number = metas?.meta_conversao ?? 0
  const metaUsuarios: number = metas?.meta_usuarios ?? 0

  // Gráfico: merge GA4 com Yampi por dia
  const dailyMap: Record<string, { date: string; users: number; revenue: number; orders: number }> = {}
  for (const d of ga4?.daily || []) {
    dailyMap[d.date] = { date: d.date, users: d.activeUsers ?? d.sessions ?? 0, revenue: 0, orders: 0 }
  }
  for (const d of yampi?.daily || []) {
    if (!dailyMap[d.date]) dailyMap[d.date] = { date: d.date, users: 0, revenue: 0, orders: 0 }
    dailyMap[d.date].revenue = d.revenue
    dailyMap[d.date].orders = d.orders
  }
  const chartData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

  const channels: any[] = ga4?.channels || []

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={lojaInfo.label} lastSync={lastSync} />

      <div className="p-6 space-y-6">

        {/* Breadcrumb */}
        <Link href="/dashboard/canais" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Sites
        </Link>

        {/* Avisos de integração */}
        {(ga4Error || yampiError) && (
          <div className="space-y-2">
            {ga4Error && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-yellow-400 text-sm">
                GA4 não configurado — adicione GA4_{loja.toUpperCase().replace('-', '_')}_PROPERTY_ID e GOOGLE_SERVICE_ACCOUNT_KEY no .env.local
              </div>
            )}
            {yampiError && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-yellow-400 text-sm">
                Yampi não configurado — adicione YAMPI_{loja === 'barba-negra' ? 'BN' : loja.toUpperCase()}_ALIAS/TOKEN/SECRET_KEY no .env.local
              </div>
            )}
          </div>
        )}

        {/* KPIs principais */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard title="Receita" value={loading ? '...' : formatCurrency(revenue)} highlight="success" size="lg" />
          <KPICard title="Pedidos" value={loading ? '...' : formatNumber(orders)} size="lg" />
          <KPICard title="Ticket Médio" value={loading ? '...' : formatCurrency(avgTicket)} size="lg" />
          <KPICard title="Receita / Usuário" value={loading ? '...' : formatCurrency(revenuePerUser)} size="lg" />
        </div>

        {/* KPIs com metas */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Taxa de Conversão</p>
            <p className={`text-2xl font-bold ${metaConversao > 0 && conversionRate >= metaConversao ? 'text-emerald-400' : metaConversao > 0 ? 'text-amber-400' : 'text-white'}`}>
              {loading ? '...' : formatPercent(conversionRate)}
            </p>
            {metaConversao > 0 && (
              <p className="text-zinc-600 text-xs mt-1">Meta: {formatPercent(metaConversao)}</p>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Usuários Ativos</p>
            <p className={`text-2xl font-bold ${metaUsuarios > 0 && activeUsers >= metaUsuarios ? 'text-emerald-400' : metaUsuarios > 0 ? 'text-amber-400' : 'text-white'}`}>
              {loading ? '...' : formatNumber(activeUsers)}
            </p>
            {metaUsuarios > 0 && (
              <p className="text-zinc-600 text-xs mt-1">Meta: {formatNumber(metaUsuarios)}</p>
            )}
          </div>
          <KPICard title="Taxa de Rejeição" value={loading ? '...' : formatPercent(bounceRate * 100)} size="lg" />
        </div>

        {/* Gráfico Receita + Usuários por dia */}
        {chartData.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1">Receita e Usuários por dia</h3>
            <p className="text-zinc-500 text-xs mb-4">{start} → {end}</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={d => d.slice(8)} />
                <YAxis yAxisId="rev" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={50} />
                <YAxis yAxisId="usr" orientation="right" tick={{ fill: '#71717a', fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                  formatter={(value: any, name: any) => [
                    name === 'Receita' ? formatCurrency(value) : formatNumber(value),
                    name,
                  ]}
                />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Receita" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} dot={false} />
                <Area yAxisId="usr" type="monotone" dataKey="users" name="Usuários" stroke="#3b82f6" fill="url(#colorUsers)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdown por canal de aquisição */}
        {channels.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Canal de Aquisição</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Canal', 'Usuários', 'Pedidos', 'Receita', 'Conversão'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {channels.map((c: any) => {
                    const conv = c.sessions > 0 ? (c.purchases / c.sessions) * 100 : 0
                    return (
                      <tr key={c.channel} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 text-white font-medium">{CANAL_PT[c.channel] || c.channel}</td>
                        <td className="py-3 px-3 text-zinc-300">{formatNumber(c.users)}</td>
                        <td className="py-3 px-3 text-emerald-400 font-medium">{formatNumber(c.purchases)}</td>
                        <td className="py-3 px-3 text-white font-semibold">{c.revenue > 0 ? formatCurrency(c.revenue) : '—'}</td>
                        <td className={`py-3 px-3 font-medium ${conv >= 1 ? 'text-emerald-400' : 'text-zinc-400'}`}>{formatPercent(conv)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {!loading && activeUsers === 0 && orders === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
            <p className="text-zinc-500 text-sm">Nenhum dado disponível para esta loja ainda.</p>
            <p className="text-zinc-600 text-xs mt-2">Configure as credenciais no .env.local e reinicie o servidor.</p>
          </div>
        )}

      </div>
    </div>
  )
}
