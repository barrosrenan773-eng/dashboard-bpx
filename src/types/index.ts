export type UserRole = 'admin' | 'gestor' | 'vendedor' | 'visualizador'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
}

export interface KPIData {
  objetivo: number
  receitaFeita: number
  diferenca: number
  investimento: number
  investimentoNecessario: number
  investimentoPendente: number
  lucro: number
  sessoes: number
  sessoesMeta: number
  conversao: number
  roas: number
  ticket: number
  cac: number
}

export interface CanalData {
  canal: string
  objetivo: number
  receitaFeita: number
  diferenca: number
  conversao: number
  conversaoIdeal: number
  vendas: number
  ticket: number
  ticketIdeal: number
  sessoes: number
  sessoesMeta: number
  roasAtual: number
  roasIdeal: number
  cac: number
  investimento: number
}

export interface VendedorData {
  vendedor: string
  gestor?: string
  valorEstimado: number
  valorRealizado: number
  diferenca: number
  conversao: number
  conversaoIdeal: number
  leads: number
  leadsN: number
  vendas: number
  ticket: number
  ticketIdeal: number
  cac: number
  roas: number
  cpl: number
  cplIdeal: number
  investimento: number
  investimentoN: number
}

export interface DailyData {
  date: string
  receita: number
  objetivo: number
  sessoes: number
  investimento: number
  conversao: number
  roas: number
  ticket: number
  cac: number
  lucro: number
}

export interface Integration {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'error'
  lastSync?: string
}

export interface DateRange {
  from: Date
  to: Date
}
