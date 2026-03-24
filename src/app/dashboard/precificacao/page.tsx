'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { KPICard } from '@/components/dashboard/KPICard'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'

export default function PrecificacaoPage() {
  return <Suspense><PrecificacaoContent /></Suspense>
}

function PrecificacaoContent() {
  const searchParams = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const start = searchParams.get('start') || firstOfMonth
  const end = searchParams.get('end') || today
  const mes = start.slice(0, 7)

  const [blingData, setBlingData] = useState<any>(null)
  const [metaAds, setMetaAds] = useState<any>(null)
  const [googleAds, setGoogleAds] = useState<any>(null)
  const [config, setConfig] = useState<any>({
    imposto_pct: 9.18,
    comissao_pct: 7.0,
    taxa_financeira_pct: 1.07,
    custos_fixos: [],
  })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [editandoConfig, setEditandoConfig] = useState(false)
  const [configEdit, setConfigEdit] = useState<any>(null)
  const [novoCusto, setNovoCusto] = useState({ nome: '', valor: '' })
  const [adicionandoCusto, setAdicionandoCusto] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/integrations/bling-produtos?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({ produtos: [] })),
      fetch(`/api/integrations/meta-vendedores?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/integrations/google-ads?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/precificacao-config?mes=${mes}`).then(r => r.json()).catch(() => null),
    ]).then(([bling, meta, gads, cfg]) => {
      setBlingData(bling)
      setMetaAds(meta)
      setGoogleAds(gads)
      if (cfg) setConfig(cfg)
      setLoading(false)
    })
  }, [start, end, mes])

  // ---- Cálculos ----
  const receita = blingData?.totalReceita || 0
  const cmv = blingData?.totalCusto || 0
  const margemBruta = receita - cmv
  const margemBrutaPct = receita > 0 ? (margemBruta / receita) * 100 : 0

  const impostos = receita * (config.imposto_pct / 100)
  const comissao = receita * (config.comissao_pct / 100)
  const taxaFinanceira = receita * (config.taxa_financeira_pct / 100)

  const cacMeta = Object.values(metaAds?.spendByVendedor || {}).reduce((s: number, v: any) => s + v, 0)
    + (metaAds?.spend || 0)
  const cacGoogle = googleAds?.totalSpend || 0
  const cacTotal = cacMeta + cacGoogle

  const custosFixosTotal = (config.custos_fixos || []).reduce((s: number, c: any) => s + Number(c.valor || 0), 0)

  const totalDespesas = impostos + comissao + taxaFinanceira + cacTotal + custosFixosTotal
  const margemLiquida = margemBruta - totalDespesas
  const margemLiquidaPct = receita > 0 ? (margemLiquida / receita) * 100 : 0

  const produtos = blingData?.produtos || []

  async function salvarConfig(cfg: any) {
    setSalvando(true)
    await fetch('/api/precificacao-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cfg, mes }),
    })
    setConfig(cfg)
    setEditandoConfig(false)
    setSalvando(false)
  }

  function iniciarEdicao() {
    setConfigEdit(JSON.parse(JSON.stringify(config)))
    setEditandoConfig(true)
  }

  function adicionarCusto() {
    if (!novoCusto.nome || !novoCusto.valor) return
    const novo = { nome: novoCusto.nome, valor: Number(novoCusto.valor) }
    const updated = { ...configEdit, custos_fixos: [...(configEdit.custos_fixos || []), novo] }
    setConfigEdit(updated)
    setNovoCusto({ nome: '', valor: '' })
    setAdicionandoCusto(false)
  }

  function removerCusto(idx: number) {
    const updated = { ...configEdit, custos_fixos: configEdit.custos_fixos.filter((_: any, i: number) => i !== idx) }
    setConfigEdit(updated)
  }

  const cor = (pct: number) => pct >= 20 ? 'success' : pct >= 10 ? 'warning' : 'error'

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Precificação & Margem" lastSync={loading ? 'carregando...' : 'agora mesmo'} />

      <div className="p-6 space-y-6">

        {/* KPIs principais */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPICard title="Receita Bruta (Bling)" value={loading ? '...' : formatCurrency(receita)} highlight="success" size="lg" />
          <KPICard title="CMV (Custo Produtos)" value={loading ? '...' : formatCurrency(cmv)} highlight="warning" size="lg" />
          <KPICard
            title="Margem Bruta"
            value={loading ? '...' : formatCurrency(margemBruta)}
            subtitle={`${margemBrutaPct.toFixed(1)}% da receita`}
            highlight={cor(margemBrutaPct)}
            size="lg"
          />
          <KPICard
            title="Margem Líquida"
            value={loading ? '...' : formatCurrency(margemLiquida)}
            subtitle={`${margemLiquidaPct.toFixed(1)}% da receita`}
            highlight={cor(margemLiquidaPct)}
            size="lg"
          />
        </div>

        {/* Bloco DRE simplificado */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Demonstrativo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">Demonstrativo do Período</h2>
            <div className="space-y-2 text-sm">
              <DRELinha label="Receita Bruta" valor={receita} destaque />
              <DRELinha label={`CMV — Custo de Produtos`} valor={-cmv} />
              <DRELinha label="= Margem Bruta" valor={margemBruta} subtotal pct={margemBrutaPct} />
              <div className="border-t border-zinc-800 pt-2 mt-2" />
              <DRELinha label={`Impostos (${config.imposto_pct}%)`} valor={-impostos} />
              <DRELinha label={`Comissão de Vendas (${config.comissao_pct}%)`} valor={-comissao} />
              <DRELinha label={`Taxa Financeira (${config.taxa_financeira_pct}%)`} valor={-taxaFinanceira} />
              <DRELinha label="CAC — Meta Ads + Google Ads" valor={-cacTotal} />
              <DRELinha label="Custos Fixos da Operação" valor={-custosFixosTotal} />
              <div className="border-t border-zinc-800 pt-2 mt-2" />
              <DRELinha label="= Margem Líquida" valor={margemLiquida} subtotal pct={margemLiquidaPct} destaque />
            </div>
          </div>

          {/* Configurações do mês */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm">Parâmetros do Mês — {mes}</h2>
              {!editandoConfig ? (
                <button onClick={iniciarEdicao} className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={() => salvarConfig(configEdit)} disabled={salvando} className="text-emerald-400 hover:text-emerald-300 p-1">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditandoConfig(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Percentuais */}
            <div className="space-y-2 mb-4">
              {[
                { key: 'imposto_pct', label: 'Imposto (Simples Nacional %)' },
                { key: 'comissao_pct', label: 'Comissão de Vendas (%)' },
                { key: 'taxa_financeira_pct', label: 'Taxa Financeira (%)' },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <span className="text-zinc-500 text-xs">{f.label}</span>
                  {editandoConfig ? (
                    <input
                      type="number"
                      step="0.01"
                      value={configEdit[f.key]}
                      onChange={e => setConfigEdit({ ...configEdit, [f.key]: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 text-right focus:outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <span className="text-zinc-300 text-xs font-medium">{config[f.key]}%</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-xs">CAC (Meta + Google Ads)</span>
                <span className="text-amber-400 text-xs font-medium">{formatCurrency(cacTotal)} — automático</span>
              </div>
            </div>

            {/* Custos fixos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Custos Fixos da Operação</span>
                {editandoConfig && (
                  <button onClick={() => setAdicionandoCusto(true)} className="text-zinc-500 hover:text-emerald-400 p-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {(editandoConfig ? configEdit.custos_fixos : config.custos_fixos || []).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-zinc-500 text-xs">{c.nome}</span>
                    <div className="flex items-center gap-2">
                      {editandoConfig ? (
                        <>
                          <input
                            type="number"
                            value={c.valor}
                            onChange={e => {
                              const arr = [...configEdit.custos_fixos]
                              arr[i] = { ...arr[i], valor: parseFloat(e.target.value) || 0 }
                              setConfigEdit({ ...configEdit, custos_fixos: arr })
                            }}
                            className="w-28 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 text-right focus:outline-none focus:border-emerald-500"
                          />
                          <button onClick={() => removerCusto(i)} className="text-zinc-600 hover:text-red-400 p-0.5">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <span className="text-zinc-300 text-xs font-medium">{formatCurrency(c.valor)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {adicionandoCusto && editandoConfig && (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      placeholder="Nome"
                      value={novoCusto.nome}
                      onChange={e => setNovoCusto({ ...novoCusto, nome: e.target.value })}
                      className="flex-1 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    <input
                      type="number"
                      placeholder="R$"
                      value={novoCusto.valor}
                      onChange={e => setNovoCusto({ ...novoCusto, valor: e.target.value })}
                      className="w-24 bg-zinc-800 border border-zinc-600 text-white text-xs rounded px-2 py-1 text-right focus:outline-none focus:border-emerald-500"
                    />
                    <button onClick={adicionarCusto} className="text-emerald-400 p-1"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setAdicionandoCusto(false)} className="text-zinc-500 p-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {(config.custos_fixos || []).length === 0 && !editandoConfig && (
                  <p className="text-zinc-600 text-xs italic">Nenhum custo fixo configurado. Clique no lápis para adicionar.</p>
                )}
                {(config.custos_fixos || []).length > 0 && (
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5">
                    <span className="text-zinc-400 text-xs font-medium">Total Custos Fixos</span>
                    <span className="text-zinc-200 text-xs font-semibold">{formatCurrency(custosFixosTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de produtos */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Margem Bruta por Produto (CMV do Bling)</h2>
          {loading ? (
            <p className="text-zinc-500 text-sm">Carregando produtos...</p>
          ) : produtos.length === 0 ? (
            <p className="text-zinc-500 text-sm">Nenhum produto encontrado para o período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Produto', 'Qtd', 'Receita', 'CMV', 'Lucro Bruto', '% Margem'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {produtos.map((p: any) => {
                    const lucro = p.revenue - p.cost
                    const pct = p.revenue > 0 ? (lucro / p.revenue) * 100 : 0
                    const cor = pct >= 40 ? 'text-emerald-400' : pct >= 20 ? 'text-yellow-400' : 'text-red-400'
                    return (
                      <tr key={p.sku} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 text-white font-medium text-xs max-w-[240px] truncate">{p.name}</td>
                        <td className="py-3 px-3 text-zinc-400 text-xs">{formatNumber(p.quantity)}</td>
                        <td className="py-3 px-3 text-zinc-300 text-xs">{formatCurrency(p.revenue)}</td>
                        <td className="py-3 px-3 text-zinc-400 text-xs">{p.cost > 0 ? formatCurrency(p.cost) : <span className="text-zinc-600">—</span>}</td>
                        <td className="py-3 px-3 text-xs">
                          <span className={p.cost > 0 ? (lucro >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-600'}>
                            {p.cost > 0 ? formatCurrency(lucro) : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {p.cost > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${pct >= 40 ? 'bg-emerald-500' : pct >= 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${cor}`}>{pct.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-zinc-600 text-xs">sem custo</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-zinc-700">
                  <tr>
                    <td className="py-3 px-3 text-white font-bold text-xs">TOTAL</td>
                    <td className="py-3 px-3 text-zinc-300 text-xs font-semibold">
                      {formatNumber(produtos.reduce((s: number, p: any) => s + p.quantity, 0))}
                    </td>
                    <td className="py-3 px-3 text-white font-semibold text-xs">{formatCurrency(receita)}</td>
                    <td className="py-3 px-3 text-zinc-400 font-semibold text-xs">{formatCurrency(cmv)}</td>
                    <td className="py-3 px-3 font-semibold text-xs">
                      <span className={margemBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(margemBruta)}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-bold ${margemBrutaPct >= 40 ? 'text-emerald-400' : margemBrutaPct >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {margemBrutaPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DRELinha({ label, valor, subtotal, pct, destaque }: {
  label: string
  valor: number
  subtotal?: boolean
  pct?: number
  destaque?: boolean
}) {
  const isNeg = valor < 0
  const color = subtotal
    ? (valor >= 0 ? 'text-emerald-400' : 'text-red-400')
    : isNeg
      ? 'text-red-400'
      : 'text-white'

  return (
    <div className={`flex items-center justify-between ${subtotal ? 'py-1' : ''}`}>
      <span className={`text-xs ${subtotal ? 'font-semibold text-zinc-300' : destaque && !subtotal ? 'font-medium text-zinc-200' : 'text-zinc-500'}`}>
        {label}
      </span>
      <div className="flex items-center gap-3">
        {pct !== undefined && (
          <span className={`text-xs ${valor >= 0 ? 'text-zinc-500' : 'text-zinc-600'}`}>{pct.toFixed(1)}%</span>
        )}
        <span className={`text-xs font-medium tabular-nums ${color}`}>
          {isNeg ? `− ${formatCurrency(Math.abs(valor))}` : formatCurrency(valor)}
        </span>
      </div>
    </div>
  )
}
