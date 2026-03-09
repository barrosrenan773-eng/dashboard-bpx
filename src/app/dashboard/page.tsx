'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { CanalTable } from '@/components/dashboard/CanalTable'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { InvestmentChart } from '@/components/charts/InvestmentChart'
import { mockCanais, mockDailyData } from '@/lib/mock-data'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

export default function DashboardPage() {
  const [yampi, setYampi] = useState<any>(null)
  const [clint, setClint] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('carregando...')

  useEffect(() => {
    const now = new Date()
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const end = now.toISOString().slice(0, 10)

    Promise.all([
      fetch(`/api/integrations/yampi?start=${start}&end=${end}`).then(r => r.json()),
      fetch(`/api/integrations/clint?start=${start}&end=${end}`).then(r => r.json()),
    ]).then(([yampiData, clintData]) => {
      setYampi(yampiData)
      setClint(clintData)
      setLastSync('agora mesmo')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Receita real = Yampi Eros + CLINT won deals
  const receitaYampi = yampi?.revenue ?? 0
  const receitaClint = clint?.revenue ?? 0
  const receitaTotal = receitaYampi + receitaClint

  const totalLeads = clint?.totalLeads ?? 0
  const wonDeals = clint?.wonDeals ?? 0
  const conversao = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0
  const ticket = yampi?.avgTicket ?? 0
  const totalOrders = yampi?.orders ?? 0

  // Objetivo do mês (fixo por enquanto - vem das metas)
  const objetivo = 4428042.76
  const diferenca = receitaTotal - objetivo
  const pctDiff = (diferenca / objetivo) * 100

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Visão Geral" lastSync={lastSync} />

      <div className="p-6 space-y-6">

        {/* KPIs principais - linha 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <div className="col-span-2">
            <KPICard
              title="Objetivo"
              value={formatCurrency(objetivo)}
              size="lg"
            />
          </div>
          <div className="col-span-2">
            <KPICard
              title="Receita Feita"
              value={loading ? '...' : formatCurrency(receitaTotal)}
              trend={loading ? undefined : pctDiff}
              trendLabel="vs objetivo"
              highlight={receitaTotal >= objetivo ? 'success' : 'danger'}
              size="lg"
            />
          </div>
          <div className="col-span-2">
            <KPICard
              title="Diferença"
              value={loading ? '...' : formatCurrency(diferenca)}
              highlight={diferenca >= 0 ? 'success' : 'danger'}
              size="lg"
            />
          </div>
          <div className="col-span-2">
            <KPICard
              title="Pedidos (Eros)"
              value={loading ? '...' : formatNumber(totalOrders)}
              subtitle="Yampi Eros no mês"
              size="lg"
            />
          </div>
        </div>

        {/* KPIs secundários - linha 2 */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KPICard
            title="Receita Yampi Eros"
            value={loading ? '...' : formatCurrency(receitaYampi)}
            subtitle="pedidos pagos"
          />
          <KPICard
            title="Receita CLINT"
            value={loading ? '...' : formatCurrency(receitaClint)}
            subtitle="deals ganhos"
          />
          <KPICard
            title="Leads (CLINT)"
            value={loading ? '...' : formatNumber(totalLeads)}
            subtitle={`${wonDeals} ganhos`}
          />
          <KPICard
            title="Conversão CRM"
            value={loading ? '...' : formatPercent(conversao)}
            highlight={conversao >= 3 ? 'success' : 'warning'}
          />
          <KPICard
            title="Ticket Médio"
            value={loading ? '...' : formatCurrency(ticket)}
            subtitle="Yampi Eros"
          />
          <KPICard
            title="Deals Ganhos"
            value={loading ? '...' : formatNumber(wonDeals)}
            highlight={wonDeals > 0 ? 'success' : 'warning'}
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1">Receita × Objetivo × Lucro</h3>
            <p className="text-zinc-500 text-xs mb-4">Últimos 30 dias</p>
            <RevenueChart data={mockDailyData} />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1">Investimento × Sessões</h3>
            <p className="text-zinc-500 text-xs mb-4">Últimos 30 dias</p>
            <InvestmentChart data={mockDailyData} />
          </div>
        </div>

        {/* Tabela de canais */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Performance por Canal</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Comparativo de métricas por canal de venda</p>
            </div>
            <span className="text-zinc-500 text-xs bg-zinc-800 px-2 py-1 rounded-md">
              {mockCanais.length} canais
            </span>
          </div>
          <CanalTable data={mockCanais} />
        </div>

      </div>
    </div>
  )
}
