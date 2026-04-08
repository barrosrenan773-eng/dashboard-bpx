'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Movimento {
  data: string // YYYY-MM-DD
  tipo: 'CREDIT' | 'DEBIT'
  valor: number
  descricao: string
  categoria: string
}

interface DiaFluxo {
  data: string // YYYY-MM-DD
  entradas: number
  saidas: number
  movimentos: Movimento[]
  saldo_calculado: number
  saldo_real: number | null
  saldo_inicial: number | null
  observacao: string
  divergente: boolean
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getMesStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function FluxoCaixaPage() {
  const today = new Date()
  const [mes, setMes] = useState(getMesStr(today))
  const [dias, setDias] = useState<DiaFluxo[]>([])
  const [loading, setLoading] = useState(true)
  const [savingDia, setSavingDia] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, { saldo_real: string; saldo_inicial: string; observacao: string }>>({})
  const [expandedDia, setExpandedDia] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch conciliações do mês
      const [historicoRes, saldosRes] = await Promise.all([
        fetch('/api/historico-conciliacoes'),
        fetch(`/api/fluxo-caixa?mes=${mes}`),
      ])
      const historico: any[] = await historicoRes.json()
      const saldos: any[] = await saldosRes.json()

      // Montar mapa de saldos por data
      const saldoMap: Record<string, any> = {}
      if (Array.isArray(saldos)) {
        for (const s of saldos) saldoMap[s.data] = s
      }

      // Extrair movimentos do mês de todas as conciliações
      const movPorDia: Record<string, Movimento[]> = {}
      if (Array.isArray(historico)) {
        for (const h of historico) {
          const detalhes: any[] = Array.isArray(h.detalhes) ? h.detalhes : []
          for (const d of detalhes) {
            const data: string = d.data || h.created_at?.slice(0, 10) || ''
            if (!data || !data.startsWith(mes)) continue
            if (!movPorDia[data]) movPorDia[data] = []
            movPorDia[data].push({
              data,
              tipo: d.tipo === 'CREDIT' ? 'CREDIT' : 'DEBIT',
              valor: Math.abs(parseFloat(d.valor) || 0),
              descricao: d.descricao || d.fitid || '',
              categoria: d.categoria || '',
            })
          }
        }
      }

      // Gerar todos os dias do mês
      const [y, m] = mes.split('-').map(Number)
      const ultimoDia = new Date(y, m, 0).getDate()
      const allDias: DiaFluxo[] = []

      // Encontrar saldo_inicial: pegar o primeiro dia que tiver saldo_inicial salvo
      let saldoAcumulado = 0
      let saldoInicialEncontrado = false

      for (let d = 1; d <= ultimoDia; d++) {
        const dataStr = `${mes}-${String(d).padStart(2, '0')}`
        const saldoDb = saldoMap[dataStr]
        const movs = movPorDia[dataStr] || []

        const entradas = movs.filter(m => m.tipo === 'CREDIT').reduce((s, m) => s + m.valor, 0)
        const saidas = movs.filter(m => m.tipo === 'DEBIT').reduce((s, m) => s + m.valor, 0)

        // Se esse dia tem saldo_inicial definido, usar como base
        if (saldoDb?.saldo_inicial != null && !saldoInicialEncontrado) {
          saldoAcumulado = parseFloat(saldoDb.saldo_inicial) || 0
          saldoInicialEncontrado = true
        }

        saldoAcumulado = saldoAcumulado + entradas - saidas

        const saldoReal = saldoDb?.saldo_real != null ? parseFloat(saldoDb.saldo_real) : null
        const divergente = saldoReal !== null && Math.abs(saldoAcumulado - saldoReal) > 0.01

        allDias.push({
          data: dataStr,
          entradas,
          saidas,
          movimentos: movs,
          saldo_calculado: saldoAcumulado,
          saldo_real: saldoReal,
          saldo_inicial: saldoDb?.saldo_inicial != null ? parseFloat(saldoDb.saldo_inicial) : null,
          observacao: saldoDb?.observacao || '',
          divergente,
        })
      }

      setDias(allDias)

      // Inicializar editValues
      const ev: Record<string, { saldo_real: string; saldo_inicial: string; observacao: string }> = {}
      for (const d of allDias) {
        ev[d.data] = {
          saldo_real: d.saldo_real != null ? String(d.saldo_real) : '',
          saldo_inicial: d.saldo_inicial != null ? String(d.saldo_inicial) : '',
          observacao: d.observacao,
        }
      }
      setEditValues(ev)
    } finally {
      setLoading(false)
    }
  }, [mes])

  useEffect(() => { loadData() }, [loadData])

  async function salvarDia(data: string) {
    const ev = editValues[data]
    if (!ev) return
    setSavingDia(data)
    try {
      await fetch('/api/fluxo-caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          saldo_real: ev.saldo_real !== '' ? parseFloat(ev.saldo_real.replace(',', '.')) : null,
          saldo_inicial: ev.saldo_inicial !== '' ? parseFloat(ev.saldo_inicial.replace(',', '.')) : null,
          observacao: ev.observacao || null,
        }),
      })
      await loadData()
    } finally {
      setSavingDia(null)
    }
  }

  function navMes(delta: number) {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMes(getMesStr(d))
  }

  const mesLabel = new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Totais do mês
  const totalEntradas = dias.reduce((s, d) => s + d.entradas, 0)
  const totalSaidas = dias.reduce((s, d) => s + d.saidas, 0)
  const saldoFinal = dias.length > 0 ? dias[dias.length - 1].saldo_calculado : 0
  const diasDivergentes = dias.filter(d => d.divergente).length

  // Dias com movimentação ou dados
  const diasAtivos = dias.filter(d => d.movimentos.length > 0 || d.saldo_real !== null || d.saldo_inicial !== null)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Fluxo de Caixa</h1>
            <p className="text-zinc-500 text-sm mt-1">Movimentações diárias conciliadas</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navMes(-1)} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 bg-zinc-900 rounded-lg text-sm font-medium capitalize min-w-[160px] text-center">
              {mesLabel}
            </span>
            <button onClick={() => navMes(1)} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Total Entradas</p>
            <p className="text-emerald-400 text-xl font-bold mt-1">{fmt(totalEntradas)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Total Saídas</p>
            <p className="text-red-400 text-xl font-bold mt-1">{fmt(totalSaidas)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Saldo Calculado</p>
            <p className={`text-xl font-bold mt-1 ${saldoFinal >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(saldoFinal)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Divergências</p>
            <p className={`text-xl font-bold mt-1 ${diasDivergentes > 0 ? 'text-yellow-400' : 'text-zinc-400'}`}>
              {diasDivergentes} {diasDivergentes === 1 ? 'dia' : 'dias'}
            </p>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Carregando...
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide w-24">Data</th>
                  <th className="text-right px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">Entradas</th>
                  <th className="text-right px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">Saídas</th>
                  <th className="text-right px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">Saldo Calc.</th>
                  <th className="text-right px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide w-36">Saldo Inicial</th>
                  <th className="text-right px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide w-36">Saldo Real</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wide">Observação</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {dias.map((dia) => {
                  const ev = editValues[dia.data] || { saldo_real: '', saldo_inicial: '', observacao: '' }
                  const temMovimento = dia.movimentos.length > 0
                  const dataDisplay = new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  const isExpanded = expandedDia === dia.data

                  return (
                    <>
                      <tr
                        key={dia.data}
                        className={`border-b border-zinc-800/50 transition-colors ${
                          dia.divergente ? 'bg-yellow-500/5' : temMovimento ? 'bg-zinc-900' : 'bg-zinc-950/40'
                        } hover:bg-zinc-800/30`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {dia.divergente ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                            ) : dia.saldo_real !== null ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5" />
                            )}
                            <button
                              onClick={() => setExpandedDia(isExpanded ? null : dia.data)}
                              className={`font-mono text-xs ${temMovimento ? 'text-white hover:text-emerald-400 cursor-pointer' : 'text-zinc-600'}`}
                            >
                              {dataDisplay}
                              {temMovimento && <span className="ml-1 text-zinc-500">({dia.movimentos.length})</span>}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {dia.entradas > 0 ? (
                            <span className="text-emerald-400 font-medium">{fmt(dia.entradas)}</span>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {dia.saidas > 0 ? (
                            <span className="text-red-400 font-medium">{fmt(dia.saidas)}</span>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold text-xs ${dia.saldo_calculado >= 0 ? 'text-zinc-300' : 'text-red-400'}`}>
                            {fmt(dia.saldo_calculado)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={ev.saldo_inicial}
                            onChange={e => setEditValues(prev => ({ ...prev, [dia.data]: { ...ev, saldo_inicial: e.target.value } }))}
                            placeholder="—"
                            className="w-full text-right bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={ev.saldo_real}
                            onChange={e => setEditValues(prev => ({ ...prev, [dia.data]: { ...ev, saldo_real: e.target.value } }))}
                            placeholder="—"
                            className={`w-full text-right bg-zinc-800 border rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 ${
                              dia.divergente ? 'border-yellow-500/60' : 'border-zinc-700'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={ev.observacao}
                            onChange={e => setEditValues(prev => ({ ...prev, [dia.data]: { ...ev, observacao: e.target.value } }))}
                            placeholder="—"
                            className="w-full bg-transparent border-b border-zinc-800 px-1 py-1 text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => salvarDia(dia.data)}
                            disabled={savingDia === dia.data}
                            className="px-2 py-1 rounded text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-50"
                          >
                            {savingDia === dia.data ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                          </button>
                        </td>
                      </tr>

                      {/* Movimentos expandidos */}
                      {isExpanded && dia.movimentos.length > 0 && (
                        <tr key={`${dia.data}-expand`} className="bg-zinc-900/80">
                          <td colSpan={8} className="px-8 py-3">
                            <div className="space-y-1">
                              {dia.movimentos.map((mov, i) => (
                                <div key={i} className="flex items-center gap-4 text-xs py-1 border-b border-zinc-800/40 last:border-0">
                                  <span className={`flex-shrink-0 flex items-center gap-1 ${mov.tipo === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {mov.tipo === 'CREDIT' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {fmt(mov.valor)}
                                  </span>
                                  <span className="text-zinc-400 flex-1 truncate">{mov.descricao || '—'}</span>
                                  {mov.categoria && (
                                    <span className="text-zinc-600 flex-shrink-0">{mov.categoria}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>

            {dias.length === 0 && (
              <div className="text-center py-16 text-zinc-600">
                Nenhum dado para este mês.
              </div>
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-6 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span>Saldo real diverge do calculado</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Saldo real conferido</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Clique na data</span>
            <span>para ver movimentos do dia</span>
          </div>
        </div>

      </div>
    </div>
  )
}
