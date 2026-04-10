/**
 * calculos.ts — Fonte Única de Verdade para cálculos BPX
 *
 * REGRAS IMUTÁVEIS:
 *   receita   = soma das taxas dos contratos
 *   lucro     = receita - despesas  (capital NÃO é despesa)
 *   margem    = lucro / receita * 100
 *   producao  = capital + taxa por contrato
 *
 * TODAS as abas devem usar estas funções. Nenhuma aba pode
 * recalcular de forma diferente.
 */

// ─── Labels canônicos dos KPIs ────────────────────────────────────────────────
// Fonte única de verdade para nomes de indicadores.
// NUNCA definir labels localmente nas páginas — importar daqui.

export const KPI_LABELS = {
  producao:      'Giro Total',
  receita:       'Receita',
  receitaTotal:  'Receita Total',
  capital:       'Capital Utilizado',
  despesas:      'Despesas',
  despesasTotal: 'Total Despesas',
  lucro:         'Lucro Líquido',
  margem:        'Margem',
  ticketMedio:   'Ticket Médio',
  taxaMedia:     'Taxa Média',
  qtdContratos:  'Contratos',
  finalizados:   'Finalizados',
  emAndamento:   'Em Andamento',
  aguardando:    'Aguardando',
  // TV / Tráfego
  roasGeral:     'ROAS Geral',
  gastTrafego:   'Gasto em Tráfego',
  metaTotal:     'Meta Total',
  investimento:  'Investimento Total',
  pctReceitaAds: '% Receita em Ads',
  // Consultores / Vendedores
  leads:           'Leads Totais',
  leadsRecebidos:  'Leads Recebidos',
  leadsHoje:       'Leads Hoje',
  leadsDia:        'Leads do Dia',
  leadsAbertos:    'Leads Abertos',
  ganhos:          'Ganhos',
  perdidos:        'Perdidos',
  conversao:       'Taxa de Conversão',
  conversaoAbrev:  'Conversão',
  trafego:         'Tráfego Total',
  ciclo:           'Ciclo Médio',
  roas:            'ROAS',
  cac:             'CAC',
  roi:             'ROI',
} as const

export type KpiLabelKey = keyof typeof KPI_LABELS

export interface Contrato {
  id: string
  nome: string
  capital: number
  taxa: number
  status: 'ativo' | 'finalizado' | 'aguardando' | string
  created_at: string
  valor_total_contrato?: number
  responsavel?: string
  servico?: string
  origem?: string
}

export interface Despesa {
  id: string | number
  descricao: string
  categoria: string
  valor: number
  mes: string
  created_at: string
}

export interface KPIs {
  receita:      number  // soma das taxas
  capital:      number  // soma do capital (NÃO é despesa)
  producao:     number  // capital + taxa
  despesas:     number  // soma das despesas operacionais
  lucro:        number  // receita - despesas
  margem:       number  // lucro / receita * 100
  ticketMedio:  number  // producao / qtd
  taxaMedia:    number  // receita / qtd
  qtdContratos: number
  finalizados:  number
  emAndamento:  number
  aguardando:   number
}

/** Calcula todos os KPIs a partir de contratos e despesas filtrados */
export function calcularKPIs(contratos: Contrato[], despesas: Despesa[]): KPIs {
  const qtdContratos = contratos.length
  const receita      = contratos.reduce((s, c) => s + (Number(c.taxa)    || 0), 0)
  const capital      = contratos.reduce((s, c) => s + (Number(c.capital) || 0), 0)
  const producao     = contratos.reduce((s, c) => {
    const prod = c.valor_total_contrato ?? ((Number(c.capital) || 0) + (Number(c.taxa) || 0))
    return s + prod
  }, 0)
  const despesasTotal = despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const lucro        = receita - despesasTotal
  const margem       = receita > 0 ? (lucro / receita) * 100 : 0
  const ticketMedio  = qtdContratos > 0 ? receita / qtdContratos : 0
  const taxaMedia    = qtdContratos > 0 ? receita  / qtdContratos : 0

  const finalizados  = contratos.filter(c => c.status === 'finalizado').length
  const emAndamento  = contratos.filter(c => c.status === 'ativo').length
  const aguardando   = contratos.filter(c => c.status === 'aguardando').length

  return {
    receita, capital, producao, despesas: despesasTotal,
    lucro, margem, ticketMedio, taxaMedia,
    qtdContratos, finalizados, emAndamento, aguardando,
  }
}

/** Calcula KPIs por mês para gráficos históricos (últimos N meses) */
export function calcularHistoricoMensal(
  contratos: Contrato[],
  despesas: Despesa[],
  meses: number = 6
): { mes: string; Producao: number; Receita: number; Capital: number; Despesas: number; Lucro: number; Margem: number }[] {
  const hoje = new Date()
  const result = []
  for (let i = meses - 1; i >= 0; i--) {
    const d  = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mc = contratos.filter(c => c.created_at?.slice(0, 7) === mk)
    const md = despesas.filter(d2 => d2.mes === mk || d2.created_at?.slice(0, 7) === mk)
    const kpi = calcularKPIs(mc, md)
    result.push({
      mes:      mesLabelCurto(mk + '-01'),
      Producao: kpi.producao,
      Receita:  kpi.receita,
      Capital:  kpi.capital,
      Despesas: kpi.despesas,
      Lucro:    kpi.lucro,
      Margem:   kpi.margem,
    })
  }
  return result
}

/** Distribuição de lucro padrão BPX */
export function calcularDistribuicaoLucro(lucro: number) {
  return [
    { nome: 'Francisco', percentual: 43.5, valor: lucro * 0.435 },
    { nome: 'Renan',     percentual: 43.5, valor: lucro * 0.435 },
    { nome: 'Felipe',    percentual: 5,    valor: lucro * 0.05  },
    { nome: 'Marcelo',   percentual: 4,    valor: lucro * 0.04  },
    { nome: 'Ingrid',    percentual: 4,    valor: lucro * 0.04  },
  ]
}

/** Filtra contratos por período e status */
export function filtrarContratos(
  contratos: Contrato[],
  dateStart: Date,
  dateEnd: Date,
  status = 'todos'
): Contrato[] {
  return contratos.filter(c => {
    const dt = new Date(c.created_at)
    const inPeriod = dt >= dateStart && dt <= dateEnd
    const inStatus = status === 'todos' || c.status === status
    return inPeriod && inStatus
  })
}

/** Filtra despesas por período */
export function filtrarDespesas(despesas: Despesa[], dateStart: Date, dateEnd: Date): Despesa[] {
  return despesas.filter(d => {
    // Exclui categorias que não são despesas operacionais
    if (d.categoria === 'compra_divida' || d.categoria === 'pl') return false
    // Filtra pelo mês de competência (campo mes) em vez de created_at
    if (d.mes) {
      const [y, m] = d.mes.split('-').map(Number)
      const dt = new Date(y, m - 1, 1)
      const startMes = new Date(dateStart.getFullYear(), dateStart.getMonth(), 1)
      const endMes = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), 1)
      return dt >= startMes && dt <= endMes
    }
    const dt = new Date(d.created_at)
    return dt >= dateStart && dt <= dateEnd
  })
}

/** Label curto do mês: "mar/25" */
export function mesLabelCurto(iso: string): string {
  const [y, m] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

/** Helpers de data */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
export function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}
