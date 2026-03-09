'use client'

import { Header } from '@/components/layout/Header'
import { mockCanais, mockDailyData, mockKPI, mockVendedores } from '@/lib/mock-data'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { Printer, TrendingUp, TrendingDown } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const MES_REF = 'Março 2026'
const canaisRelatorio = mockCanais.filter(c => c.canal !== 'Email' && c.canal !== 'Amazon' && c.canal !== 'Shopee')
const vendedoresOrdenados = [...mockVendedores].sort((a, b) => b.valorRealizado - a.valorRealizado)

function MetaBadge({ pct }: { pct: number }) {
  if (pct >= 100) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{pct.toFixed(0)}%</span>
  if (pct >= 70) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{pct.toFixed(0)}%</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{pct.toFixed(0)}%</span>
}

export default function RelatoriosPage() {
  const totalReceitaCanais = canaisRelatorio.reduce((s, c) => s + c.receitaFeita, 0)
  const totalObjetivoCanais = canaisRelatorio.reduce((s, c) => s + c.objetivo, 0)
  const totalInvestCanais = canaisRelatorio.reduce((s, c) => s + c.investimento, 0)
  const totalVendasCanais = canaisRelatorio.reduce((s, c) => s + c.vendas, 0)
  const pctMeta = totalObjetivoCanais > 0 ? (totalReceitaCanais / totalObjetivoCanais) * 100 : 0

  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Relatórios" lastSync="dados de referência" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">

        {/* Cabeçalho do relatório */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-white">Damatta<span className="text-emerald-400">.</span></span>
              <span className="text-zinc-600">|</span>
              <span className="text-white font-semibold">Relatório Executivo</span>
            </div>
            <p className="text-zinc-500 text-sm">Período de referência: <span className="text-zinc-300">{MES_REF}</span></p>
            <p className="text-zinc-600 text-xs mt-0.5">Gerado em {dataGeracao}</p>
          </div>
          <button
            onClick={() => window.open('/dashboard/relatorios/print', '_blank')}
            className="no-print flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </button>
        </div>

        {/* Resumo Executivo */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
            Resumo Executivo
          </h2>

          {/* Barra de progresso da meta */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Receita vs Objetivo — {MES_REF}</span>
              <span className={`text-sm font-bold ${pctMeta >= 100 ? 'text-emerald-400' : pctMeta >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {pctMeta.toFixed(1)}% do objetivo
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(pctMeta, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-zinc-400 text-xs">{formatCurrency(totalReceitaCanais)} realizado</span>
              <span className="text-zinc-600 text-xs">{formatCurrency(totalObjetivoCanais)} objetivo</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Receita Total', value: formatCurrency(mockKPI.receitaFeita), sub: `obj: ${formatCurrency(mockKPI.objetivo)}`, up: mockKPI.receitaFeita >= mockKPI.objetivo },
              { label: 'Investimento', value: formatCurrency(mockKPI.investimento), sub: 'total investido no período', up: null },
              { label: 'Lucro Bruto', value: formatCurrency(mockKPI.lucro), sub: `margem: ${((mockKPI.lucro / mockKPI.receitaFeita) * 100).toFixed(1)}%`, up: mockKPI.lucro > 0 },
              { label: '% Receita em Ads', value: `${((mockKPI.investimento / mockKPI.receitaFeita) * 100).toFixed(1)}%`, sub: `${formatCurrency(mockKPI.investimento)} em anúncios`, up: (mockKPI.investimento / mockKPI.receitaFeita) <= 0.30 },
              { label: 'ROAS', value: mockKPI.roas.toFixed(2), sub: 'retorno sobre investimento', up: mockKPI.roas >= 3 },
              { label: 'Conversão', value: formatPercent(mockKPI.conversao), sub: 'leads → vendas', up: mockKPI.conversao >= 3 },
              { label: 'Ticket Médio', value: formatCurrency(mockKPI.ticket), sub: 'por venda', up: null },
            ].map(item => (
              <div key={item.label} className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1 truncate">{item.label}</p>
                <div className="flex items-center gap-1.5">
                  <p className={`text-lg font-bold truncate ${item.up === true ? 'text-emerald-400' : item.up === false ? 'text-red-400' : 'text-white'}`}>
                    {item.value}
                  </p>
                  {item.up === true && <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {item.up === false && <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                </div>
                <p className="text-zinc-600 text-xs mt-0.5 truncate">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Performance por Canal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full inline-block" />
            Performance por Canal de Vendas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  {['Canal', 'Receita', 'Objetivo', '% Meta', 'Investimento', 'ROAS', 'Conversão', 'Ticket', 'Vendas', 'CAC'].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {canaisRelatorio.map(c => {
                  const pct = c.objetivo > 0 ? (c.receitaFeita / c.objetivo) * 100 : 0
                  return (
                    <tr key={c.canal} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 text-white font-semibold whitespace-nowrap">{c.canal}</td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold whitespace-nowrap">{formatCurrency(c.receitaFeita)}</td>
                      <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">{formatCurrency(c.objetivo)}</td>
                      <td className="py-3 px-3 whitespace-nowrap"><MetaBadge pct={pct} /></td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatCurrency(c.investimento)}</td>
                      <td className={`py-3 px-3 font-semibold whitespace-nowrap ${c.roasAtual >= c.roasIdeal ? 'text-emerald-400' : 'text-red-400'}`}>{c.roasAtual.toFixed(2)}</td>
                      <td className={`py-3 px-3 whitespace-nowrap ${c.conversao >= c.conversaoIdeal ? 'text-emerald-400' : 'text-zinc-300'}`}>{formatPercent(c.conversao)}</td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatCurrency(c.ticket)}</td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatNumber(c.vendas)}</td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatCurrency(c.cac)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-700 bg-zinc-800/40">
                  <td className="py-3 px-3 text-white font-bold">TOTAL</td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">{formatCurrency(totalReceitaCanais)}</td>
                  <td className="py-3 px-3 text-zinc-400 font-bold">{formatCurrency(totalObjetivoCanais)}</td>
                  <td className="py-3 px-3"><MetaBadge pct={pctMeta} /></td>
                  <td className="py-3 px-3 text-zinc-300 font-bold">{formatCurrency(totalInvestCanais)}</td>
                  <td className="py-3 px-3 text-white font-bold">{totalInvestCanais > 0 ? (totalReceitaCanais / totalInvestCanais).toFixed(2) : '—'}</td>
                  <td className="py-3 px-3 text-zinc-300 font-bold">—</td>
                  <td className="py-3 px-3 text-zinc-300 font-bold">{totalVendasCanais > 0 ? formatCurrency(totalReceitaCanais / totalVendasCanais) : '—'}</td>
                  <td className="py-3 px-3 text-zinc-300 font-bold">{formatNumber(totalVendasCanais)}</td>
                  <td className="py-3 px-3 text-zinc-300 font-bold">{totalVendasCanais > 0 ? formatCurrency(totalInvestCanais / totalVendasCanais) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Performance por Vendedor */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-purple-500 rounded-full inline-block" />
            Performance por Vendedor
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  {['#', 'Vendedor', 'Leads', 'Vendas', 'Conversão', 'Receita', 'Objetivo', '% Meta', 'Ticket', 'ROAS'].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {vendedoresOrdenados.map((v, i) => {
                  const pct = v.valorEstimado > 0 ? (v.valorRealizado / v.valorEstimado) * 100 : 0
                  return (
                    <tr key={v.vendedor} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 text-zinc-500 text-xs">{i + 1}</td>
                      <td className="py-3 px-3 text-white font-semibold whitespace-nowrap">{v.vendedor}</td>
                      <td className="py-3 px-3 text-zinc-300">{formatNumber(v.leads)}</td>
                      <td className="py-3 px-3 text-zinc-300">{formatNumber(v.vendas)}</td>
                      <td className={`py-3 px-3 font-medium ${v.conversao >= v.conversaoIdeal ? 'text-emerald-400' : 'text-zinc-300'}`}>{formatPercent(v.conversao)}</td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold whitespace-nowrap">{formatCurrency(v.valorRealizado)}</td>
                      <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">{formatCurrency(v.valorEstimado)}</td>
                      <td className="py-3 px-3"><MetaBadge pct={pct} /></td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">{formatCurrency(v.ticket)}</td>
                      <td className={`py-3 px-3 font-semibold ${v.roas >= 20 ? 'text-emerald-400' : 'text-zinc-300'}`}>{v.roas.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico de evolução */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-1 flex items-center gap-2">
            <span className="w-1 h-5 bg-yellow-500 rounded-full inline-block" />
            Evolução de Receita — {MES_REF}
          </h2>
          <p className="text-zinc-500 text-xs mb-4">Receita diária vs Objetivo</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockDailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={52} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                formatter={(v: any) => [formatCurrency(v)]}
              />
              <Area type="monotone" dataKey="objetivo" name="Objetivo" stroke="#52525b" fill="none" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" fill="url(#gradReceita)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Rodapé */}
        <div className="text-center py-4 border-t border-zinc-800">
          <p className="text-zinc-600 text-xs">Damatta. — Relatório Executivo {MES_REF} — Gerado em {dataGeracao} — Uso interno</p>
        </div>

      </div>
    </div>
  )
}
