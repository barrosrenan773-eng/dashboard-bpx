import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { CanalTable } from '@/components/dashboard/CanalTable'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { mockCanais, mockDailyData } from '@/lib/mock-data'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'

// Lojas com dashboard de detalhe
const LOJAS_DETALHADAS: Record<string, string> = {
  'BPX Eros': '/dashboard/canais/eros',
  'Barba Negra': '/dashboard/canais/barba-negra',
  'BPX Farma': '/dashboard/canais/farma',
}

export default function CanaisPage() {
  const totalReceita = mockCanais.reduce((s, c) => s + c.receitaFeita, 0)
  const totalInvestimento = mockCanais.reduce((s, c) => s + c.investimento, 0)
  const totalVendas = mockCanais.reduce((s, c) => s + c.vendas, 0)
  const totalSessoes = mockCanais.reduce((s, c) => s + c.sessoes, 0)

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Canais" lastSync="dados mockados" />

      <div className="p-6 space-y-6">

        {/* KPIs resumo */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard title="Receita Total" value={formatCurrency(totalReceita)} highlight="success" size="lg" />
          <KPICard title="Investimento Total" value={formatCurrency(totalInvestimento)} size="lg" />
          <KPICard title="Vendas Totais" value={formatNumber(totalVendas)} size="lg" />
          <KPICard title="Sessões Totais" value={formatNumber(totalSessoes)} size="lg" />
        </div>

        {/* Cards por canal */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockCanais.map((canal) => {
            const pct = ((canal.receitaFeita / canal.objetivo) * 100)
            const atingiu = canal.receitaFeita >= canal.objetivo
            const href = LOJAS_DETALHADAS[canal.canal]

            const CardContent = (
              <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-full ${href ? 'hover:border-zinc-600 transition-colors cursor-pointer' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">{canal.canal}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${atingiu ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {pct.toFixed(0)}% da meta
                    </span>
                    {href && <ArrowUpRight className="w-4 h-4 text-zinc-500" />}
                  </div>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-4">
                  <div
                    className={`h-1.5 rounded-full ${atingiu ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-zinc-500 text-xs">Receita</p>
                    <p className={`font-semibold text-sm mt-0.5 ${atingiu ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(canal.receitaFeita)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Objetivo</p>
                    <p className="text-white font-semibold text-sm mt-0.5">{formatCurrency(canal.objetivo)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">ROAS</p>
                    <p className={`font-semibold text-sm mt-0.5 ${canal.roasAtual >= canal.roasIdeal ? 'text-emerald-400' : 'text-red-400'}`}>
                      {canal.roasAtual.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Conversão</p>
                    <p className={`font-semibold text-sm mt-0.5 ${canal.conversao >= canal.conversaoIdeal ? 'text-emerald-400' : 'text-red-400'}`}>
                      {canal.conversao.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Sessões</p>
                    <p className="text-white font-semibold text-sm mt-0.5">{formatNumber(canal.sessoes)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">CAC</p>
                    <p className="text-white font-semibold text-sm mt-0.5">{formatCurrency(canal.cac)}</p>
                  </div>
                </div>

                {href && (
                  <p className="text-zinc-600 text-xs mt-4">Clique para ver detalhes →</p>
                )}
              </div>
            )

            return href ? (
              <Link key={canal.canal} href={href} className="block h-full">
                {CardContent}
              </Link>
            ) : (
              <div key={canal.canal}>{CardContent}</div>
            )
          })}
        </div>

        {/* Gráfico */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">Receita diária</h3>
          <p className="text-zinc-500 text-xs mb-4">Últimos 30 dias — todos os canais</p>
          <RevenueChart data={mockDailyData} />
        </div>

        {/* Tabela detalhada */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Tabela completa por canal</h3>
          <CanalTable data={mockCanais} />
        </div>

      </div>
    </div>
  )
}
