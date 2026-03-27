'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { KPI_LABELS } from '@/lib/calculos'
import {
  Calendar, Lock, Unlock, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, FileText, Banknote, Users, RefreshCw,
  Download, X, Clock, ArrowRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Closure {
  id: string
  mes_referencia: string
  data_fechamento: string | null
  status: 'open' | 'closed'
  receita_total: number
  despesas_totais: number
  lucro_liquido: number
  margem: number
  contratos_total: number
  contratos_finalizados: number
  contratos_pendentes: number
  capital_total: number
  capital_disponivel: number
  capital_em_operacao: number
  capital_travado: number
  distribuicao_lucro: { nome: string; percentual: number; valor: number }[]
  snapshot_completo: Record<string, unknown>
  criado_em: string
}

interface Carryover {
  id: string
  mes_origem: string
  mes_destino: string
  tipo: string
  referencia_id: string
  valor: number
  descricao: string
  status: 'pendente' | 'resolvido' | 'cancelado'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function fmtMes(m: string) {
  const [y, mo] = m.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[Number(mo) - 1]} ${y}`
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    contrato_pendente: 'Contrato Pendente',
    capital_fora: 'Capital Fora',
    valor_nao_liquidado: 'Não Liquidado',
    capital_judicializado: 'Judicializado',
  }
  return map[tipo] || tipo
}

function tipoColor(tipo: string) {
  if (tipo === 'capital_judicializado') return 'text-red-400 bg-red-400/10 border-red-400/20'
  if (tipo === 'contrato_pendente')     return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
  if (tipo === 'capital_fora')          return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color = 'border-zinc-700',
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color?: string
}) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 border-t-2 ${color}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-zinc-400 text-sm">{label}</span>
        <div className="p-2 rounded-lg bg-zinc-800">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  closure, onConfirm, onCancel, loading,
}: {
  closure: Closure
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const lucroPositivo = closure.lucro_liquido >= 0
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Confirmar Fechamento — {fmtMes(closure.mes_referencia)}</h3>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Resumo */}
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Resumo do Mês</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-zinc-500 text-xs">Receita</p>
                <p className="text-emerald-400 font-semibold">{fmt(closure.receita_total)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Despesas</p>
                <p className="text-red-400 font-semibold">{fmt(closure.despesas_totais)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Lucro Líquido</p>
                <p className={`font-semibold ${lucroPositivo ? 'text-violet-400' : 'text-red-400'}`}>
                  {fmt(closure.lucro_liquido)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Margem</p>
                <p className={`font-semibold ${lucroPositivo ? 'text-emerald-400' : 'text-red-400'}`}>
                  {closure.margem.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Capital Total</p>
                <p className="text-blue-400 font-semibold">{fmt(closure.capital_total)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Contratos</p>
                <p className="text-white font-semibold">{closure.contratos_total} total</p>
              </div>
            </div>
          </div>

          {/* Pendências */}
          {closure.contratos_pendentes > 0 && (
            <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-400 text-sm font-medium">
                  {closure.contratos_pendentes} contrato{closure.contratos_pendentes > 1 ? 's' : ''} pendente{closure.contratos_pendentes > 1 ? 's' : ''}
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Serão transportados automaticamente para o próximo mês.
                </p>
              </div>
            </div>
          )}

          {/* Aviso imutabilidade */}
          <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl p-4">
            <Lock className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 text-sm font-medium">Ação irreversível</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                O snapshot deste mês será congelado. Nenhum dado poderá ser alterado diretamente após o fechamento.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Fechando...' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SnapshotModal ────────────────────────────────────────────────────────────

function SnapshotModal({ closure, onClose }: { closure: Closure; onClose: () => void }) {
  const snap = closure.snapshot_completo as {
    contratos?: { lista?: { nome: string; servico: string; capital: number; taxa: number; status: string }[] }
    despesas?: { descricao: string; categoria: string; valor: number }[]
    financeiro?: { receita: number; despesas: number; lucro: number; margem: number }
    capital?: { total: number; disponivel: number; em_operacao: number; travado: number }
  }

  function exportCSV() {
    const rows = [
      ['Mês', closure.mes_referencia],
      ['Receita', closure.receita_total],
      ['Despesas', closure.despesas_totais],
      ['Lucro', closure.lucro_liquido],
      ['Margem %', closure.margem],
      ['Capital Total', closure.capital_total],
      ['Contratos Total', closure.contratos_total],
      ['Finalizados', closure.contratos_finalizados],
      ['Pendentes', closure.contratos_pendentes],
      [],
      ['Distribuição de Lucro'],
      ...closure.distribuicao_lucro.map(d => [d.nome, `${d.percentual}%`, d.valor]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fechamento-${closure.mes_referencia}.csv`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-semibold">Snapshot — {fmtMes(closure.mes_referencia)}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">Imutável</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { l: 'Receita',   v: fmt(closure.receita_total),  c: 'text-emerald-400' },
              { l: 'Despesas',  v: fmt(closure.despesas_totais), c: 'text-red-400' },
              { l: 'Lucro',     v: fmt(closure.lucro_liquido),  c: closure.lucro_liquido >= 0 ? 'text-violet-400' : 'text-red-400' },
              { l: 'Margem',    v: `${closure.margem.toFixed(1)}%`, c: 'text-blue-400' },
            ].map(k => (
              <div key={k.l} className="bg-zinc-800 rounded-xl p-3">
                <p className="text-zinc-500 text-xs">{k.l}</p>
                <p className={`font-bold text-lg ${k.c}`}>{k.v}</p>
              </div>
            ))}
          </div>

          {/* Capital */}
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Capital</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { l: 'Total',        v: fmt(closure.capital_total) },
                { l: 'Disponível',   v: fmt(closure.capital_disponivel) },
                { l: 'Em Operação',  v: fmt(closure.capital_em_operacao) },
                { l: 'Travado',      v: fmt(closure.capital_travado) },
              ].map(k => (
                <div key={k.l} className="bg-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">{k.l}</p>
                  <p className="text-white font-semibold">{k.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Distribuição */}
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">Distribuição de Lucro</p>
            <div className="space-y-2">
              {closure.distribuicao_lucro.map(d => (
                <div key={d.nome} className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2.5">
                  <span className="text-white text-sm font-medium">{d.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 text-sm">{d.percentual}%</span>
                    <span className="text-emerald-400 font-semibold text-sm">{fmt(d.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contratos */}
          {snap?.contratos?.lista && snap.contratos.lista.length > 0 && (
            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                Contratos ({snap.contratos.lista.length})
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {snap.contratos.lista.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-white text-xs font-medium">{c.nome}</span>
                      <span className="text-zinc-500 text-xs ml-2">{c.servico}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-400 text-xs">{fmt(c.capital)}</span>
                      <span className="text-emerald-400 text-xs">{fmt(c.taxa)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        c.status === 'finalizado' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
                        c.status === 'ativo'      ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
                        'text-amber-400 bg-amber-400/10 border-amber-400/20'
                      }`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FechamentoPage() {
  const [closures, setClosures] = useState<Closure[]>([])
  const [carryover, setCarryover] = useState<Carryover[]>([])
  const [mesAtual, setMesAtual] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState<Closure | null>(null)
  const [fechando, setFechando] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState<Closure | null>(null)
  const [expandedCarryover, setExpandedCarryover] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fechamento')
    const json = await res.json()
    setClosures(json.closures || [])
    setCarryover(json.carryover || [])
    setMesAtual(json.mesAtual || '')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function executarFechamento() {
    if (!confirmando) return
    setFechando(true)
    const res = await fetch('/api/fechamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes_referencia: confirmando.mes_referencia }),
    })
    const json = await res.json()
    setFechando(false)
    setConfirmando(null)
    if (json.success) {
      setSuccessMsg(`Mês ${fmtMes(confirmando.mes_referencia)} fechado com sucesso! ${json.carryover_gerado} pendência(s) transportada(s).`)
      setTimeout(() => setSuccessMsg(''), 5000)
      load()
    } else {
      alert('Erro: ' + json.error)
    }
  }

  const closureAtual = closures.find(c => c.mes_referencia === mesAtual)
  const fechados = closures.filter(c => c.status === 'closed').sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))
  const carryoverMesAtual = carryover.filter(c => c.mes_destino === mesAtual)

  // Alerta: tem mês anterior aberto que não foi fechado?
  const mesAnteriorStr = (() => {
    const [y, m] = mesAtual.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const mesAnteriorAberto = closures.find(c => c.mes_referencia === mesAnteriorStr && c.status === 'open')

  return (
    <div className="flex-1 overflow-auto bg-zinc-950">
      <Header title="Fechamento Mensal" />

      <div className="p-6 space-y-6">

        {/* Alerta de mês anterior pendente */}
        {mesAnteriorAberto && (
          <div className="flex items-center gap-4 bg-amber-400/5 border border-amber-400/30 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-amber-400 font-medium text-sm">
                {fmtMes(mesAnteriorStr)} ainda não foi fechado
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Recomendamos fechar o mês anterior antes de continuar operando no mês atual.
              </p>
            </div>
            <button
              onClick={() => setConfirmando(mesAnteriorAberto)}
              className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors"
            >
              Fechar agora
            </button>
          </div>
        )}

        {/* Sucesso */}
        {successMsg && (
          <div className="flex items-center gap-3 bg-emerald-400/5 border border-emerald-400/30 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-400 text-sm">{successMsg}</p>
          </div>
        )}

        {/* Mês Atual */}
        <div>
          <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">Mês Atual</h2>
          {closureAtual ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{fmtMes(closureAtual.mes_referencia)}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-emerald-400/10 border-emerald-400/20 text-emerald-400">
                        <Unlock className="w-3 h-3" /> Aberto
                      </span>
                      {carryoverMesAtual.length > 0 && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-400/10 border-amber-400/20 text-amber-400">
                          <ArrowRight className="w-3 h-3" />
                          {carryoverMesAtual.length} pendência(s) transportada(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmando(closureAtual)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  Fechar Mês
                </button>
              </div>

              {/* KPIs do mês atual */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label={KPI_LABELS.receita} value={fmt(closureAtual.receita_total)} icon={TrendingUp} color="border-emerald-500" />
                <KpiCard label={KPI_LABELS.despesas} value={fmt(closureAtual.despesas_totais)} icon={TrendingDown} color="border-red-500" />
                <KpiCard label={KPI_LABELS.lucro} value={fmt(closureAtual.lucro_liquido)}
                  sub={`Margem ${closureAtual.margem.toFixed(1)}%`}
                  icon={DollarSign} color="border-violet-500" />
                <KpiCard label={KPI_LABELS.capital} value={fmt(closureAtual.capital_total)} icon={Banknote} color="border-blue-500" />
              </div>

              {/* Contratos resumo */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <KpiCard label="Total Contratos" value={String(closureAtual.contratos_total)} icon={FileText} />
                <KpiCard label="Finalizados" value={String(closureAtual.contratos_finalizados)} icon={CheckCircle2} color="border-emerald-500" />
                <KpiCard label="Pendentes" value={String(closureAtual.contratos_pendentes)} icon={Clock} color={closureAtual.contratos_pendentes > 0 ? 'border-amber-500' : 'border-zinc-700'} />
              </div>

              {/* Carryover do mês atual */}
              {carryoverMesAtual.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setExpandedCarryover(expandedCarryover === mesAtual ? null : mesAtual)}
                    className="flex items-center gap-2 text-zinc-400 text-sm hover:text-white transition-colors"
                  >
                    {expandedCarryover === mesAtual ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Pendências transportadas do mês anterior ({carryoverMesAtual.length})
                  </button>
                  {expandedCarryover === mesAtual && (
                    <div className="mt-2 space-y-1">
                      {carryoverMesAtual.map(c => (
                        <div key={c.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${tipoColor(c.tipo)}`}>
                              {tipoLabel(c.tipo)}
                            </span>
                            <span className="text-zinc-300 text-sm">{c.descricao}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-blue-400 font-medium">{fmt(c.valor)}</span>
                            <span className="text-xs text-zinc-500">de {fmtMes(c.mes_origem)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              {loading ? (
                <RefreshCw className="w-6 h-6 text-zinc-600 animate-spin mx-auto" />
              ) : (
                <p className="text-zinc-500 text-sm">Nenhum dado para o mês atual.</p>
              )}
            </div>
          )}
        </div>

        {/* Histórico de Fechamentos */}
        <div>
          <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">
            Histórico de Fechamentos ({fechados.length})
          </h2>
          {fechados.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <Lock className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Nenhum mês fechado ainda.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Mês</th>
                    <th className="text-left px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Data Fechamento</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Receita</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Despesas</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Lucro</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Margem</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Contratos</th>
                    <th className="text-right px-5 py-3 text-zinc-500 text-xs font-medium uppercase">Pendentes</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {fechados.map(c => {
                    const carryoverDeste = carryover.filter(co => co.mes_origem === c.mes_referencia)
                    return (
                      <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center">
                              <Lock className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">{fmtMes(c.mes_referencia)}</p>
                              <p className="text-xs text-zinc-600">{c.mes_referencia}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-zinc-400 text-sm">
                            {c.data_fechamento
                              ? new Date(c.data_fechamento).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-emerald-400 font-medium text-sm">{fmt(c.receita_total)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-red-400 text-sm">{fmt(c.despesas_totais)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold text-sm ${c.lucro_liquido >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                            {fmt(c.lucro_liquido)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-sm ${c.margem >= 30 ? 'text-emerald-400' : c.margem >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                            {c.margem.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-zinc-400 text-sm">{c.contratos_total}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {c.contratos_pendentes > 0 ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-400/10 border-amber-400/20 text-amber-400">
                              {c.contratos_pendentes}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-400/10 border-emerald-400/20 text-emerald-400">
                              0
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSnapshotOpen(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Snapshot
                            </button>
                            {carryoverDeste.length > 0 && (
                              <button
                                onClick={() => setExpandedCarryover(expandedCarryover === c.mes_referencia ? null : c.mes_referencia)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-amber-400 text-xs transition-colors"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                {carryoverDeste.length} transport.
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="space-y-1">
              <p className="text-white text-sm font-medium">Como funciona o Fechamento Mensal</p>
              <ul className="text-zinc-500 text-xs space-y-1 list-disc list-inside">
                <li>Ao fechar um mês, um <strong className="text-zinc-400">snapshot imutável</strong> é criado com todos os dados do período</li>
                <li>Contratos e capital pendentes são <strong className="text-zinc-400">automaticamente transportados</strong> para o mês seguinte</li>
                <li>Meses fechados <strong className="text-zinc-400">não podem ser editados diretamente</strong> — garantia de histórico confiável</li>
                <li>O sistema alerta automaticamente quando há meses abertos pendentes de fechamento</li>
                <li>Snapshots podem ser exportados em CSV a qualquer momento</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      {confirmando && (
        <ConfirmModal
          closure={confirmando}
          onConfirm={executarFechamento}
          onCancel={() => setConfirmando(null)}
          loading={fechando}
        />
      )}
      {snapshotOpen && (
        <SnapshotModal closure={snapshotOpen} onClose={() => setSnapshotOpen(null)} />
      )}
    </div>
  )
}
