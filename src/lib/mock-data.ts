import type { KPIData, CanalData, DailyData, VendedorData } from '@/types'

export const mockKPI: KPIData = {
  objetivo: 4428042.76,
  receitaFeita: 3231996.67,
  diferenca: -1196046.09,
  investimento: 909797.00,
  investimentoNecessario: 1387524.81,
  investimentoPendente: 477727.81,
  lucro: 914860.24,
  sessoes: 530023,
  sessoesMeta: 671228.45,
  conversao: 3.51,
  roas: 3.55,
  ticket: 173.50,
  cac: 48.84,
}

export const mockCanais: CanalData[] = [
  {
    canal: 'Amazon',
    objetivo: 74036.55,
    receitaFeita: 34127.84,
    diferenca: -39908.71,
    conversao: 12.43,
    conversaoIdeal: 13.13,
    vendas: 350,
    ticket: 97.51,
    ticketIdeal: 94.28,
    sessoes: 2816,
    sessoesMeta: 4511.87,
    roasAtual: 7.65,
    roasIdeal: 6.76,
    cac: 12.74,
    investimento: 4461.60,
  },
  {
    canal: 'Barba Negra',
    objetivo: 1943928.69,
    receitaFeita: 1283955.62,
    diferenca: -659973.07,
    conversao: 2.68,
    conversaoIdeal: 2.57,
    vendas: 5938,
    ticket: 216.23,
    ticketIdeal: 227.70,
    sessoes: 221228,
    sessoesMeta: 268568.57,
    roasAtual: 3.34,
    roasIdeal: 2.51,
    cac: 64.74,
    investimento: 384162.00,
  },
  {
    canal: 'Damatta Eros',
    objetivo: 2022289.18,
    receitaFeita: 1549718.24,
    diferenca: -472570.94,
    conversao: 4.13,
    conversaoIdeal: 3.02,
    vendas: 9626,
    ticket: 160.99,
    ticketIdeal: 156.94,
    sessoes: 232866,
    sessoesMeta: 311822.66,
    roasAtual: 3.59,
    roasIdeal: 2.20,
    cac: 44.87,
    investimento: 431765.00,
  },
  {
    canal: 'Damatta Farma',
    objetivo: 303654.16,
    receitaFeita: 266646.12,
    diferenca: -37008.04,
    conversao: 3.25,
    conversaoIdeal: 2.22,
    vendas: 1989,
    ticket: 134.06,
    ticketIdeal: 143.17,
    sessoes: 61136,
    sessoesMeta: 69554.10,
    roasAtual: 3.29,
    roasIdeal: 2.21,
    cac: 40.79,
    investimento: 80967.00,
  },
  {
    canal: 'Shopee',
    objetivo: 78874.42,
    receitaFeita: 84328.86,
    diferenca: 5454.44,
    conversao: 5.66,
    conversaoIdeal: 2.97,
    vendas: 673,
    ticket: 125.30,
    ticketIdeal: 135.83,
    sessoes: 11885,
    sessoesMeta: 16771.26,
    roasAtual: 12.37,
    roasIdeal: 8.23,
    cac: 10.13,
    investimento: 6815.00,
  },
]

export const mockVendedores: VendedorData[] = [
  { vendedor: 'Aline', gestor: 'Gestora A', valorEstimado: 286070.34, valorRealizado: 268193.85, diferenca: -17876.49, conversao: 58.39, conversaoIdeal: 60, leads: 2146, leadsN: 0, vendas: 1253, ticket: 214.04, ticketIdeal: 243, cac: 1.62, roas: 131.84, cpl: 0.95, cplIdeal: 0, investimento: 2034.24, investimentoN: 0 },
  { vendedor: 'Amanda CRM', gestor: 'Gestora A', valorEstimado: 196915.49, valorRealizado: 151059.91, diferenca: -45855.58, conversao: 28.45, conversaoIdeal: 32, leads: 3533, leadsN: 2208.77, vendas: 1005, ticket: 150.31, ticketIdeal: 144, cac: 8.93, roas: 16.84, cpl: 2.54, cplIdeal: 2.2, investimento: 8970.25, investimentoN: 5130.09 },
  { vendedor: 'Amanda Loja', gestor: 'Gestora A', valorEstimado: 196915.49, valorRealizado: 179224.64, diferenca: -17690.85, conversao: 82.22, conversaoIdeal: 95, leads: 1620, leadsN: 607.01, vendas: 1332, ticket: 134.55, ticketIdeal: 137, cac: 0.45, roas: 298.9, cpl: 0.37, cplIdeal: 0, investimento: 599.61, investimentoN: 0 },
  { vendedor: 'Arthur', gestor: 'Gestor B', valorEstimado: 198269.06, valorRealizado: 176087.27, diferenca: -22181.79, conversao: 18.34, conversaoIdeal: 25, leads: 6701, leadsN: 0, vendas: 1229, ticket: 143.28, ticketIdeal: 0, cac: 8.1, roas: 17.68, cpl: 1.49, cplIdeal: 0, investimento: 9959.19, investimentoN: 0 },
  { vendedor: 'Arthur CRM', gestor: 'Gestor B', valorEstimado: 98519.95, valorRealizado: 52870.03, diferenca: -45649.92, conversao: 26.52, conversaoIdeal: 30, leads: 1410, leadsN: 2117.49, vendas: 374, ticket: 141.36, ticketIdeal: 146, cac: 9.14, roas: 15.47, cpl: 2.42, cplIdeal: 2.2, investimento: 3417.63, investimentoN: 4883.4 },
  { vendedor: 'Arthur Loja', gestor: 'Gestor B', valorEstimado: 98519.95, valorRealizado: 65227.87, diferenca: -33292.08, conversao: 97.45, conversaoIdeal: 95, leads: 470, leadsN: 506.01, vendas: 458, ticket: 142.42, ticketIdeal: 146, cac: 0, roas: 0, cpl: 0, cplIdeal: 0, investimento: 0, investimentoN: 0 },
  { vendedor: 'Carlos', gestor: 'Gestor B', valorEstimado: 15000, valorRealizado: 9116.68, diferenca: -5883.32, conversao: 19.21, conversaoIdeal: 20, leads: 177, leadsN: 523.68, vendas: 34, ticket: 268.14, ticketIdeal: 150, cac: 13.26, roas: 20.22, cpl: 2.55, cplIdeal: 2.85, investimento: 450.84, investimentoN: 1492.32 },
  { vendedor: 'Daniele', gestor: 'Gestora C', valorEstimado: 120000, valorRealizado: 101687.25, diferenca: -18312.75, conversao: 25.56, conversaoIdeal: 28, leads: 1792, leadsN: 0, vendas: 458, ticket: 222.01, ticketIdeal: 0, cac: 8.46, roas: 26.26, cpl: 2.16, cplIdeal: 0, investimento: 3872.77, investimentoN: 0 },
  { vendedor: 'Daniele Meta', gestor: 'Gestora C', valorEstimado: 95000, valorRealizado: 25942.79, diferenca: -24356.03, conversao: 16.19, conversaoIdeal: 26, leads: 883, leadsN: 1847.07, vendas: 143, ticket: 181.43, ticketIdeal: 260, cac: 17.14, roas: 10.59, cpl: 2.78, cplIdeal: 1.95, investimento: 2450.98, investimentoN: 4049.68 },
  { vendedor: 'Fabiane', gestor: 'Gestora C', valorEstimado: 242000, valorRealizado: 242243.99, diferenca: -38685.77, conversao: 18.52, conversaoIdeal: 25, leads: 7153, leadsN: 1857.07, vendas: 1325, ticket: 182.91, ticketIdeal: 185, cac: 9, roas: 20.3, cpl: 1.67, cplIdeal: 1.52, investimento: 11929.79, investimentoN: 3066.13 },
]

// Gera dados diários simulados (últimos 30 dias)
function generateDailyData(): DailyData[] {
  const data: DailyData[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    const base = 22000 + Math.random() * 12000
    const invest = 8000 + Math.random() * 5000
    data.push({
      date: label,
      receita: Math.round(base),
      objetivo: 25000,
      sessoes: Math.round(4000 + Math.random() * 4000),
      investimento: Math.round(invest),
      conversao: parseFloat((2 + Math.random() * 2).toFixed(2)),
      roas: parseFloat((2.5 + Math.random() * 1.5).toFixed(2)),
      ticket: parseFloat((150 + Math.random() * 60).toFixed(2)),
      cac: parseFloat((40 + Math.random() * 30).toFixed(2)),
      lucro: Math.round(base - invest - base * 0.35),
    })
  }
  return data
}

export const mockDailyData: DailyData[] = generateDailyData()
