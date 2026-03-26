export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

import { Header } from '@/components/layout/Header'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { createClient } from '@supabase/supabase-js'
import { TrendingUp, TrendingDown, Target, FileText } from 'lucide-react'
import { ClintSection } from './ClintSection'

function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co'),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  )
}

async function getMetaAds(mes: string, start?: string, end?: string) {
  try {
    const token = process.env.META_ADS_ACCESS_TOKEN
    const accountId = process.env.META_ADS_ACCOUNT_ID
    if (!token || !accountId) return null
    let timeRange: string
    if (start && end) {
      timeRange = encodeURIComponent(JSON.stringify({ since: start, until: end }))
    } else {
      const [y, m] = mes.split('-')
      const lastDay = new Date(Number(y), Number(m), 0).getDate()
      timeRange = encodeURIComponent(JSON.stringify({ since: `${mes}-01`, until: `${mes}-${String(lastDay).padStart(2,'0')}` }))
    }
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend,actions&time_range=${timeRange}&access_token=${token}`,
      { cache: 'no-store' }
    )
    const json = await res.json()
    if (json.error) return { error: json.error.message as string, spend: 0, conversas: null, custoPorConversa: null }
    if (!json.data?.[0]) return { spend: 0, conversas: null, custoPorConversa: null }
    const d = json.data[0]
    const actions: { action_type: string; value: string }[] = d.actions ?? []
    const conversations =
      actions.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value ??
      actions.find(a => a.action_type === 'messaging_conversation_started_7d')?.value ??
      null
    const spend = parseFloat(d.spend)
    const convCount = conversations ? parseInt(conversations) : null
    return {
      spend,
      conversas: convCount,
      custoPorConversa: convCount && convCount > 0 ? spend / convCount : null,
      error: null,
    }
  } catch (e) { return { error: String(e), spend: 0, conversas: null, custoPorConversa: null } }
}


const DISTRIBUICAO = [
  { nome: 'Francisco', pct: 45.5 },
  { nome: 'Renan',     pct: 45.5 },
  { nome: 'Felipe',    pct: 5.0  },
  { nome: 'Marcelo',   pct: 4.0  },
]

export default async function GeralPage({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  const { start, end } = await searchParams
  const hoje = new Date()
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const mesLabel = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const supabase = getSupabase()

  // Busca dados em paralelo
  const [{ data: contratos }, { data: despesas }, metaAds] = await Promise.all([
    supabase.from('contratos').select('taxa, capital, status'),
    supabase.from('despesas').select('valor, categoria').eq('mes', mes),
    getMetaAds(mes, start, end),
  ])

  // Contratos
  const totalContratos = (contratos ?? []).length
  const totalCapital = (contratos ?? []).reduce((s: number, c: { capital: number }) => s + (c.capital ?? 0), 0)
  const finalizados = (contratos ?? []).filter((c: { status: string }) => c.status === 'finalizado').length
  const totalTaxas = (contratos ?? []).reduce((s: number, c: { taxa: number }) => s + (c.taxa ?? 0), 0)

  // Financeiro
  const totalDespesasManual = (despesas ?? []).reduce((s: number, d: { valor: number }) => s + (d.valor ?? 0), 0)
  const marketing = metaAds?.spend ?? 0
  const totalDespesas = totalDespesasManual + marketing
  const lucro = totalTaxas - totalDespesas
  const margem = totalTaxas > 0 ? (lucro / totalTaxas) * 100 : 0

  const despesasPorCategoria = {
    fixa: (despesas ?? []).filter((d: { categoria: string }) => d.categoria === 'fixa').reduce((s: number, d: { valor: number }) => s + d.valor, 0),
    variavel: (despesas ?? []).filter((d: { categoria: string }) => d.categoria === 'variavel').reduce((s: number, d: { valor: number }) => s + d.valor, 0),
    pix: (despesas ?? []).filter((d: { categoria: string }) => d.categoria === 'pix').reduce((s: number, d: { valor: number }) => s + d.valor, 0),
    pessoal: (despesas ?? []).filter((d: { categoria: string }) => d.categoria === 'pessoal').reduce((s: number, d: { valor: number }) => s + d.valor, 0),
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Visão Geral" lastSync={`mês atual — ${mesLabel}`} />

      <div className="p-6 space-y-6">

        {/* Filtro de período para Marketing */}
        <form method="GET" className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-zinc-500 text-xs">Período do marketing:</span>
          <input type="date" name="start" defaultValue={start ?? ''} className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-orange-500" />
          <span className="text-zinc-600 text-xs">até</span>
          <input type="date" name="end" defaultValue={end ?? ''} className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-orange-500" />
          <button type="submit" className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium px-3 py-1 rounded transition-colors">Filtrar</button>
          {(start || end) && <a href="/dashboard/geral" className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Limpar</a>}
          {(start || end) && <span className="text-orange-400 text-xs">{start} → {end}</span>}
        </form>

        {/* KPIs + Top Consultores — CRM (Clint) — carregado client-side */}
        <ClintSection mes={mes} mesLabel={mesLabel} />

        {/* KPIs — financeiro */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Taxas (Contratos)</p>
              <div className="p-1.5 bg-emerald-500/10 rounded-lg"><FileText className="w-3.5 h-3.5 text-emerald-400" /></div>
            </div>
            <p className="text-white font-bold text-2xl">{formatCurrency(totalTaxas)}</p>
            <p className="text-zinc-500 text-xs mt-1">{totalContratos} contratos · capital {formatCurrency(totalCapital)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Despesas</p>
              <div className="p-1.5 bg-red-500/10 rounded-lg"><TrendingDown className="w-3.5 h-3.5 text-red-400" /></div>
            </div>
            <p className="text-white font-bold text-2xl">{formatCurrency(totalDespesas)}</p>
            <p className="text-zinc-500 text-xs mt-1">fixas + variáveis + marketing</p>
          </div>
          <div className={`border rounded-xl p-5 ${lucro >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Lucro Líquido</p>
              <div className={`p-1.5 rounded-lg ${lucro >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <TrendingUp className={`w-3.5 h-3.5 ${lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
            </div>
            <p className={`font-bold text-2xl ${lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(lucro)}</p>
            <p className="text-zinc-500 text-xs mt-1">margem {margem.toFixed(1)}%</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Marketing</p>
              <div className="p-1.5 bg-blue-500/10 rounded-lg"><Target className="w-3.5 h-3.5 text-blue-400" /></div>
            </div>
            <p className="text-white font-bold text-2xl">{formatCurrency(metaAds?.spend ?? 0)}</p>
            <p className="text-zinc-500 text-xs mt-1">
              {metaAds?.error
                ? <span className="text-red-400">{metaAds.error}</span>
                : metaAds?.conversas
                  ? `${metaAds.conversas} conversas · ${formatCurrency(metaAds.custoPorConversa ?? 0)}/conv`
                  : start && end ? `${start} → ${end}` : 'Facebook Ads'
              }
            </p>
          </div>
        </div>

        {/* Breakdown despesas */}
        <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">

          {/* Breakdown despesas + Marketing */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Despesas por Categoria</h3>
            <div className="space-y-3">
              {[
                { label: 'Despesas Fixas', val: despesasPorCategoria.fixa, color: 'bg-blue-500' },
                { label: 'Despesas Variáveis', val: despesasPorCategoria.variavel, color: 'bg-yellow-500' },
                { label: 'Tarifas Pix', val: despesasPorCategoria.pix, color: 'bg-purple-500' },
                { label: 'Despesas com Pessoal', val: despesasPorCategoria.pessoal, color: 'bg-orange-500' },
                { label: 'Marketing (Facebook)', val: marketing, color: 'bg-blue-400' },
              ].map(({ label, val, color }) => {
                const pct = totalDespesas > 0 ? (val / totalDespesas) * 100 : 0
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{label}</span>
                      <span className="text-white font-medium">{formatCurrency(val)}</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${color}/70`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Distribuição do lucro */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Distribuição do Lucro — {mesLabel}</h3>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {DISTRIBUICAO.map(({ nome, pct }) => {
              const valor = lucro > 0 ? (lucro * pct) / 100 : 0
              return (
                <div key={nome} className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">{nome}</p>
                  <p className={`font-bold text-xl ${lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(valor)}</p>
                  <p className="text-zinc-500 text-xs mt-1">{pct}% do lucro</p>
                </div>
              )
            })}
          </div>
          {lucro < 0 && (
            <p className="text-red-400 text-xs text-center mt-3 bg-red-500/10 rounded-lg py-2">
              Resultado negativo — sem distribuição no período
            </p>
          )}
        </div>

        {/* Resultado resumido */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Resultado do Mês</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Receitas</p>
              {clint && (
                <div className="flex justify-between">
                  <span className="text-zinc-400 text-sm">CRM (deals ganhos)</span>
                  <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(totalReceitaClint)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Taxas de contratos</span>
                <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(totalTaxas)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Despesas</p>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Fixas</span>
                <span className="text-red-400 text-sm">{formatCurrency(despesasPorCategoria.fixa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Variáveis</span>
                <span className="text-red-400 text-sm">{formatCurrency(despesasPorCategoria.variavel)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Pix</span>
                <span className="text-red-400 text-sm">{formatCurrency(despesasPorCategoria.pix)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Pessoal</span>
                <span className="text-red-400 text-sm">{formatCurrency(despesasPorCategoria.pessoal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Marketing</span>
                <span className="text-red-400 text-sm">{formatCurrency(marketing)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Resultado</p>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Lucro líquido</span>
                <span className={`font-bold text-sm ${lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(lucro)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 text-sm">Margem</span>
                <span className={`font-semibold text-sm ${margem >= 40 ? 'text-emerald-400' : margem >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>{margem.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
