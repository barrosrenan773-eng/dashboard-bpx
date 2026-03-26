import { Header } from '@/components/layout/Header'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

async function getMetaAds(start?: string, end?: string) {
  try {
    const token = process.env.META_ADS_ACCESS_TOKEN
    const accountId = process.env.META_ADS_ACCOUNT_ID
    if (!token || !accountId) return null
    const dateParam = start && end
      ? `time_range=${encodeURIComponent(JSON.stringify({ since: start, until: end }))}`
      : `date_preset=this_month`
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend,impressions,clicks,cpc&${dateParam}&access_token=${token}`,
      { cache: 'no-store' }
    )
    const json = await res.json()
    if (json.error || !json.data?.[0]) return null
    const d = json.data[0]
    return { spend: parseFloat(d.spend), impressions: parseInt(d.impressions), clicks: parseInt(d.clicks), cpc: parseFloat(d.cpc ?? 0) }
  } catch { return null }
}

// Mock data — substitua pelas suas fontes reais
const MOCK_MENSAL = [
  { mes: 'Out/24', receita: 312400, leads: 1420, ganhos: 198, conversao: 13.9, ticket: 1578 },
  { mes: 'Nov/24', receita: 389200, leads: 1631, ganhos: 237, conversao: 14.5, ticket: 1642 },
  { mes: 'Dez/24', receita: 421800, leads: 1758, ganhos: 258, conversao: 14.7, ticket: 1635 },
  { mes: 'Jan/25', receita: 358600, leads: 1540, ganhos: 219, conversao: 14.2, ticket: 1637 },
  { mes: 'Fev/25', receita: 401200, leads: 1695, ganhos: 248, conversao: 14.6, ticket: 1617 },
  { mes: 'Mar/25', receita: 487320, leads: 1842, ganhos: 276, conversao: 14.9, ticket: 1765 },
]

const MOCK_VENDEDORES = [
  { name: 'Ana Silva', receita: 98400, leads: 312, won: 47, conversao: 15.1, ticket: 2093 },
  { name: 'Carlos Souza', receita: 87200, leads: 289, won: 41, conversao: 14.2, ticket: 2127 },
  { name: 'Fernanda Lima', receita: 76500, leads: 251, won: 38, conversao: 15.1, ticket: 2013 },
  { name: 'Rodrigo Alves', receita: 65100, leads: 228, won: 32, conversao: 14.0, ticket: 2034 },
  { name: 'Juliana Costa', receita: 58900, leads: 198, won: 29, conversao: 14.6, ticket: 2031 },
  { name: 'Marcos Ferreira', receita: 51200, leads: 187, won: 27, conversao: 14.4, ticket: 1896 },
  { name: 'Patricia Mendes', receita: 32100, leads: 245, won: 38, conversao: 15.5, ticket: 845 },
  { name: 'Lucas Oliveira', receita: 18020, leads: 132, won: 24, conversao: 18.2, ticket: 751 },
]

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const params = await searchParams
  const start = params.start ?? ''
  const end = params.end ?? ''
  const metaAds = await getMetaAds(start || undefined, end || undefined)
  const melhorMes = [...MOCK_MENSAL].sort((a, b) => b.receita - a.receita)[0]
  const crescimento = ((MOCK_MENSAL[5].receita - MOCK_MENSAL[0].receita) / MOCK_MENSAL[0].receita) * 100
  const maxReceita = Math.max(...MOCK_MENSAL.map(m => m.receita))

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Relatórios" lastSync="dados mockados" />

      <div className="p-6 space-y-6">

        {/* Filtro de período para Meta Ads */}
        <form method="GET" className="flex items-center gap-3 flex-wrap">
          <span className="text-zinc-400 text-sm">Período do tráfego:</span>
          <input
            type="date"
            name="start"
            defaultValue={start}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <span className="text-zinc-500 text-sm">até</span>
          <input
            type="date"
            name="end"
            defaultValue={end}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Filtrar
          </button>
          {(start || end) && (
            <a href="/dashboard/relatorios" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              Limpar
            </a>
          )}
        </form>

        {/* KPIs de resumo histórico */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Melhor Mês</p>
            <p className="text-white font-bold text-xl">{melhorMes.mes}</p>
            <p className="text-emerald-400 text-sm mt-1">{formatCurrency(melhorMes.receita)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Crescimento</p>
            <p className="text-white font-bold text-xl">{crescimento > 0 ? '+' : ''}{crescimento.toFixed(1)}%</p>
            <p className="text-zinc-500 text-sm mt-1">últimos 6 meses</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Média Mensal</p>
            <p className="text-white font-bold text-xl">
              {formatCurrency(MOCK_MENSAL.reduce((s, m) => s + m.receita, 0) / MOCK_MENSAL.length)}
            </p>
            <p className="text-zinc-500 text-sm mt-1">últimos 6 meses</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Total 6 Meses</p>
            <p className="text-white font-bold text-xl">
              {formatCurrency(MOCK_MENSAL.reduce((s, m) => s + m.receita, 0))}
            </p>
            <p className="text-zinc-500 text-sm mt-1">acumulado</p>
          </div>
        </div>

        {/* Tráfego pago */}
        {metaAds !== null && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Tráfego Pago</p>
                <h3 className="text-white font-semibold text-base mt-0.5">
                  Facebook Ads — {start && end ? `${start} a ${end}` : 'Mês Atual'}
                </h3>
              </div>
              <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full font-medium">Meta Ads</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Gasto Total</p>
                <p className="text-white font-bold text-2xl">{formatCurrency(metaAds.spend)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Impressões</p>
                <p className="text-white font-bold text-2xl">{formatNumber(metaAds.impressions)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Cliques</p>
                <p className="text-white font-bold text-2xl">{formatNumber(metaAds.clicks)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">CPC Médio</p>
                <p className="text-white font-bold text-2xl">{formatCurrency(metaAds.cpc)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Gráfico de barras mensal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-6">Receita por Mês</h3>
          <div className="flex items-end gap-4 h-48">
            {MOCK_MENSAL.map((m) => {
              const height = (m.receita / maxReceita) * 100
              return (
                <div key={m.mes} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-zinc-500 text-xs">{formatCurrency(m.receita).replace('R$\u00a0', '')}</span>
                  <div className="w-full bg-zinc-800 rounded-t-md relative" style={{ height: '140px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-emerald-500/70 hover:bg-emerald-500 rounded-t-md transition-colors"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-zinc-400 text-xs">{m.mes}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabela histórica mensal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Histórico Mensal</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Mês', 'Receita', 'Leads', 'Ganhos', 'Conversão', 'Ticket Médio'].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[...MOCK_MENSAL].reverse().map((m) => (
                  <tr key={m.mes} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-3 text-white font-medium">{m.mes}</td>
                    <td className="py-3 px-3 text-white font-semibold">{formatCurrency(m.receita)}</td>
                    <td className="py-3 px-3 text-zinc-300">{formatNumber(m.leads)}</td>
                    <td className="py-3 px-3 text-emerald-400 font-medium">{formatNumber(m.ganhos)}</td>
                    <td className={`py-3 px-3 font-medium ${m.conversao >= 15 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {formatPercent(m.conversao)}
                    </td>
                    <td className="py-3 px-3 text-zinc-300">{formatCurrency(m.ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela por vendedor */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Performance por Consultor — Mês Atual</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['#', 'Consultor', 'Receita', 'Leads', 'Ganhos', 'Conversão', 'Ticket Médio', '% Receita Total'].map(h => (
                    <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {MOCK_VENDEDORES.map((v, i) => {
                  const receitaTotal = MOCK_VENDEDORES.reduce((s, x) => s + x.receita, 0)
                  const pct = (v.receita / receitaTotal) * 100
                  return (
                    <tr key={v.name} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-3 text-zinc-500 text-xs">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="py-3 px-3 text-white font-medium whitespace-nowrap">{v.name}</td>
                      <td className="py-3 px-3 text-white font-semibold">{formatCurrency(v.receita)}</td>
                      <td className="py-3 px-3 text-zinc-300">{formatNumber(v.leads)}</td>
                      <td className="py-3 px-3 text-emerald-400 font-medium">{formatNumber(v.won)}</td>
                      <td className={`py-3 px-3 font-medium ${v.conversao >= 15 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {formatPercent(v.conversao)}
                      </td>
                      <td className="py-3 px-3 text-zinc-300">{formatCurrency(v.ticket)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-zinc-800 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-zinc-400 text-xs">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
