'use client'

import { mockCanais, mockKPI, mockVendedores } from '@/lib/mock-data'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

const MES_REF = 'Março 2026'
const canaisRelatorio = mockCanais.filter(c => c.canal !== 'Email' && c.canal !== 'Amazon' && c.canal !== 'Shopee')
const vendedoresOrdenados = [...mockVendedores].sort((a, b) => b.valorRealizado - a.valorRealizado)

function MetaBadge({ pct }: { pct: number }) {
  const color = pct >= 100 ? '#10b981' : pct >= 70 ? '#eab308' : '#ef4444'
  return <span style={{ color, fontWeight: 700, fontSize: 12 }}>{pct.toFixed(0)}%</span>
}

export default function PrintPage() {
  const totalReceitaCanais = canaisRelatorio.reduce((s, c) => s + c.receitaFeita, 0)
  const totalObjetivoCanais = canaisRelatorio.reduce((s, c) => s + c.objetivo, 0)
  const totalInvestCanais = canaisRelatorio.reduce((s, c) => s + c.investimento, 0)
  const totalVendasCanais = canaisRelatorio.reduce((s, c) => s + c.vendas, 0)
  const pctMeta = totalObjetivoCanais > 0 ? (totalReceitaCanais / totalObjetivoCanais) * 100 : 0

  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #09090b; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
        .page { max-width: 960px; margin: 0 auto; padding: 40px 32px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; color: #71717a; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; border-bottom: 1px solid #27272a; }
        td { padding: 10px 12px; border-bottom: 1px solid #18181b; color: #d4d4d8; }
        tfoot td { border-top: 2px solid #3f3f46; border-bottom: none; font-weight: 700; background: #18181b; }
        .section { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 600; color: #fff; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px; }
        .accent { width: 4px; height: 20px; border-radius: 2px; display: inline-block; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .kpi-card { background: #27272a; border-radius: 8px; padding: 16px; }
        .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin-bottom: 4px; }
        .kpi-value { font-size: 20px; font-weight: 700; color: #fff; }
        .kpi-sub { font-size: 11px; color: #52525b; margin-top: 2px; }
        .progress-bar { width: 100%; background: #27272a; border-radius: 9999px; height: 10px; margin: 8px 0 4px; overflow: hidden; }
        .progress-fill { height: 10px; border-radius: 9999px; }
        .no-print { }
        .footer { text-align: center; padding: 24px 0 8px; border-top: 1px solid #27272a; color: #52525b; font-size: 11px; }
        @media print {
          .no-print { display: none !important; }
          body { background: #09090b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .section { break-inside: avoid; }
          .page { padding: 20px 24px; }
        }
      `}</style>

      <div className="page">

        {/* Controles (ocultos na impressão) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button
            onClick={() => window.close()}
            style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#a1a1aa', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
          >
            ← Fechar
          </button>
          <button
            onClick={() => window.print()}
            style={{ background: '#10b981', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Imprimir / Salvar PDF
          </button>
        </div>

        {/* Cabeçalho */}
        <div className="section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                Damatta<span style={{ color: '#10b981' }}>.</span>
              </span>
              <span style={{ color: '#3f3f46', fontSize: 20 }}>|</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#e4e4e7' }}>Relatório Executivo</span>
            </div>
            <p style={{ color: '#71717a', fontSize: 13, margin: 0 }}>Período de referência: <strong style={{ color: '#d4d4d8' }}>{MES_REF}</strong></p>
            <p style={{ color: '#52525b', fontSize: 11, margin: '2px 0 0' }}>Gerado em {dataGeracao} · Uso interno</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#52525b', fontSize: 11, margin: 0 }}>Diretoria de Receita</p>
          </div>
        </div>

        {/* Resumo Executivo */}
        <div className="section">
          <h2 className="section-title">
            <span className="accent" style={{ background: '#10b981' }} />
            Resumo Executivo
          </h2>

          {/* Progresso da meta */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#a1a1aa', fontSize: 13 }}>Receita vs Objetivo — {MES_REF}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: pctMeta >= 100 ? '#10b981' : pctMeta >= 70 ? '#eab308' : '#ef4444' }}>
                {pctMeta.toFixed(1)}% atingido
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(pctMeta, 100)}%`, background: pctMeta >= 100 ? '#10b981' : '#3b82f6' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#a1a1aa', fontSize: 11 }}>{formatCurrency(mockKPI.receitaFeita)} realizado</span>
              <span style={{ color: '#52525b', fontSize: 11 }}>{formatCurrency(mockKPI.objetivo)} objetivo</span>
            </div>
          </div>

          <div className="kpi-grid">
            {[
              { label: 'Receita Total', value: formatCurrency(mockKPI.receitaFeita), sub: `Objetivo: ${formatCurrency(mockKPI.objetivo)}`, color: '#10b981' },
              { label: 'Investimento Total', value: formatCurrency(mockKPI.investimento), sub: 'Total investido no período', color: '#fff' },
              { label: 'Lucro Bruto', value: formatCurrency(mockKPI.lucro), sub: `Margem: ${((mockKPI.lucro / mockKPI.receitaFeita) * 100).toFixed(1)}%`, color: '#10b981' },
              { label: 'ROAS Geral', value: mockKPI.roas.toFixed(2), sub: 'Retorno sobre ad spend', color: mockKPI.roas >= 3 ? '#10b981' : '#ef4444' },
              { label: 'Taxa de Conversão', value: formatPercent(mockKPI.conversao), sub: 'Leads → Vendas', color: mockKPI.conversao >= 3 ? '#10b981' : '#d4d4d8' },
              { label: 'Ticket Médio', value: formatCurrency(mockKPI.ticket), sub: 'Por venda realizada', color: '#fff' },
              { label: '% Receita em Ads', value: `${((mockKPI.investimento / mockKPI.receitaFeita) * 100).toFixed(1)}%`, sub: `${formatCurrency(mockKPI.investimento)} investido em anúncios`, color: (mockKPI.investimento / mockKPI.receitaFeita) <= 0.30 ? '#10b981' : '#eab308' },
            ].map(item => (
              <div key={item.label} className="kpi-card">
                <div className="kpi-label">{item.label}</div>
                <div className="kpi-value" style={{ color: item.color }}>{item.value}</div>
                <div className="kpi-sub">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance por Canal */}
        <div className="section">
          <h2 className="section-title">
            <span className="accent" style={{ background: '#3b82f6' }} />
            Performance por Canal de Vendas
          </h2>
          <table>
            <thead>
              <tr>
                {['Canal', 'Receita', 'Objetivo', '% Meta', 'Investimento', 'ROAS', 'Conversão', 'Ticket', 'Vendas', 'CAC'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canaisRelatorio.map(c => {
                const pct = c.objetivo > 0 ? (c.receitaFeita / c.objetivo) * 100 : 0
                return (
                  <tr key={c.canal}>
                    <td style={{ color: '#fff', fontWeight: 600 }}>{c.canal}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(c.receitaFeita)}</td>
                    <td>{formatCurrency(c.objetivo)}</td>
                    <td><MetaBadge pct={pct} /></td>
                    <td>{formatCurrency(c.investimento)}</td>
                    <td style={{ color: c.roasAtual >= c.roasIdeal ? '#10b981' : '#ef4444', fontWeight: 600 }}>{c.roasAtual.toFixed(2)}</td>
                    <td style={{ color: c.conversao >= c.conversaoIdeal ? '#10b981' : '#d4d4d8' }}>{formatPercent(c.conversao)}</td>
                    <td>{formatCurrency(c.ticket)}</td>
                    <td>{formatNumber(c.vendas)}</td>
                    <td>{formatCurrency(c.cac)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ color: '#fff' }}>TOTAL</td>
                <td style={{ color: '#10b981' }}>{formatCurrency(totalReceitaCanais)}</td>
                <td>{formatCurrency(totalObjetivoCanais)}</td>
                <td><MetaBadge pct={pctMeta} /></td>
                <td>{formatCurrency(totalInvestCanais)}</td>
                <td style={{ color: '#fff' }}>{totalInvestCanais > 0 ? (totalReceitaCanais / totalInvestCanais).toFixed(2) : '—'}</td>
                <td>—</td>
                <td>{totalVendasCanais > 0 ? formatCurrency(totalReceitaCanais / totalVendasCanais) : '—'}</td>
                <td>{formatNumber(totalVendasCanais)}</td>
                <td>{totalVendasCanais > 0 ? formatCurrency(totalInvestCanais / totalVendasCanais) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Performance por Vendedor */}
        <div className="section">
          <h2 className="section-title">
            <span className="accent" style={{ background: '#a855f7' }} />
            Performance por Vendedor
          </h2>
          <table>
            <thead>
              <tr>
                {['#', 'Vendedor', 'Leads', 'Vendas', 'Conversão', 'Receita', 'Objetivo', '% Meta', 'Ticket', 'ROAS'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendedoresOrdenados.map((v, i) => {
                const pct = v.valorEstimado > 0 ? (v.valorRealizado / v.valorEstimado) * 100 : 0
                return (
                  <tr key={v.vendedor}>
                    <td style={{ color: '#71717a', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ color: '#fff', fontWeight: 600 }}>{v.vendedor}</td>
                    <td>{formatNumber(v.leads)}</td>
                    <td>{formatNumber(v.vendas)}</td>
                    <td style={{ color: v.conversao >= v.conversaoIdeal ? '#10b981' : '#d4d4d8' }}>{formatPercent(v.conversao)}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(v.valorRealizado)}</td>
                    <td style={{ color: '#71717a' }}>{formatCurrency(v.valorEstimado)}</td>
                    <td><MetaBadge pct={pct} /></td>
                    <td>{formatCurrency(v.ticket)}</td>
                    <td style={{ color: v.roas >= 20 ? '#10b981' : '#d4d4d8', fontWeight: 600 }}>{v.roas.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="footer">
          Damatta. — Relatório Executivo {MES_REF} — Gerado em {dataGeracao} — Documento de uso interno
        </div>

      </div>
    </>
  )
}
