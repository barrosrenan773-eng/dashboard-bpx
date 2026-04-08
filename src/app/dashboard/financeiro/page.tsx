'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Upload,
  FileText,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Users,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { calcularDistribuicaoLucro, mesLabelCurto, KPI_LABELS } from '@/lib/calculos'

// ─── Types ────────────────────────────────────────────────────────────────────

type OFXTransaction = {
  fitid: string
  tipo: string
  data: string
  valor: number
  descricao: string
  mes: string
}

type OFXCategoria = 'ignorar' | 'fixa' | 'variavel' | 'pix' | 'pessoal' | 'dept_pessoal' | 'comissao_corretor' | 'comissao_gerente' | 'marketing' | 'servico_terceirizado' | 'impostos' | 'taxas_bancarias' | 'compra_divida' | 'despesas_diversas' | 'devolucao_emprestimo'

type Despesa = {
  id: number
  descricao: string
  categoria: string
  valor: number
  mes: string
  empresa: string
  data?: string
  created_at: string
}

type Receita = {
  id: number
  descricao: string
  categoria: string
  valor: number
  mes: string
  empresa: string
  created_at: string
}

const EMPRESAS = ['BPX', 'CCA1', 'CCA2'] as const
type Empresa = typeof EMPRESAS[number]

type AddingState = {
  categoria: string
  descricao: string
  valor: string
  empresa: string
} | null

type EditingState = {
  id: number
  descricao: string
  valor: string
} | null

// ─── Contas a Pagar ────────────────────────────────────────────────────────────

type ContaPagar = {
  id: number
  descricao: string
  fornecedor: string
  categoria: string
  valor: number
  data_vencimento: string
  status: 'a_vencer' | 'vencido' | 'pago'
  data_pagamento: string | null
  parcela_atual: number | null
  total_parcelas: number | null
  parcelamento_id: string | null
  created_at: string
}

type ContaForm = {
  tipo: 'unica' | 'parcelada' | 'fixa_mensal'
  descricao: string
  fornecedor: string
  categoria: string
  valor: string
  // unica
  data_vencimento: string
  parcela_atual: string
  total_parcelas: string
  // fixa_mensal
  dia_vencimento: string
  mes_inicio: string
  mes_fim: string
}

const CONTA_CATEGORIAS = [
  { key: 'dept_pessoal',         label: 'Departamento Pessoal' },
  { key: 'comissao_corretor',    label: 'Comissão de Corretor' },
  { key: 'comissao_gerente',     label: 'Comissão de Gerente' },
  { key: 'marketing',            label: 'Marketing' },
  { key: 'servico_terceirizado', label: 'Serviço Terceirizado' },
  { key: 'impostos',             label: 'Impostos' },
  { key: 'taxas_bancarias',      label: 'Taxas Bancárias' },
  { key: 'despesas_diversas',    label: 'Despesas Diversas' },
  { key: 'devolucao_emprestimo', label: 'Devolução de Empréstimos' },
  { key: 'bonificacao',          label: 'Bonificação' },
  { key: 'pl',                   label: 'PL' },
]

const FORM_VAZIO: ContaForm = {
  tipo: 'unica',
  descricao: '', fornecedor: '', categoria: 'despesas_diversas', valor: '',
  data_vencimento: '', parcela_atual: '', total_parcelas: '',
  dia_vencimento: '10',
  mes_inicio: new Date().toISOString().slice(0, 7),
  mes_fim: '',
}

function statusLabel(s: ContaPagar['status']) {
  if (s === 'pago')    return { label: 'Pago',     color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' }
  if (s === 'vencido') return { label: 'Vencido',  color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30' }
  return                      { label: 'A vencer', color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/30' }
}

// Gera lista de YYYY-MM de mes_inicio até mes_fim inclusive
function gerarMeses(inicio: string, fim: string): string[] {
  const meses: string[] = []
  const [yi, mi] = inicio.split('-').map(Number)
  const [yf, mf] = fim.split('-').map(Number)
  let y = yi, m = mi
  while (y < yf || (y === yf && m <= mf)) {
    meses.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return meses
}

function ContasPagarModal({ onClose }: { onClose: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const dozeAtras = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().slice(0, 10)
  const umAnoFrente = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10)
  const mesAtual = new Date().toISOString().slice(0, 7)

  const [contas, setContas]         = useState<ContaPagar[]>([])
  const [loadingC, setLoadingC]     = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroInicio, setFiltroInicio]     = useState(dozeAtras)
  const [filtroFim, setFiltroFim]           = useState(umAnoFrente)
  const [adicionando, setAdicionando] = useState(false)
  const [editandoConta, setEditandoConta] = useState<ContaPagar | null>(null)
  const [form, setForm] = useState<ContaForm>({ ...FORM_VAZIO, data_vencimento: hoje, mes_inicio: mesAtual })
  const [salvando, setSalvando] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState<number | null>(null)

  async function loadContas() {
    setLoadingC(true)
    const params = new URLSearchParams({ inicio: filtroInicio, fim: filtroFim })
    if (filtroStatus)    params.set('status', filtroStatus)
    if (filtroCategoria) params.set('categoria', filtroCategoria)
    const r = await fetch(`/api/contas-pagar?${params}`)
    const data = await r.json()
    setContas(Array.isArray(data) ? data : [])
    setLoadingC(false)
  }

  useEffect(() => { loadContas() }, [filtroStatus, filtroCategoria, filtroInicio, filtroFim])

  function fecharForm() {
    // Blur forçado: dismiss qualquer picker nativo (date/month) antes do React desmontar o form.
    // Sem isso, browsers como Chrome/Safari/Firefox tentam remover elementos do picker
    // que já não estão na árvore DOM → NotFoundError: removeChild
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setAdicionando(false)
    setEditandoConta(null)
    setForm({ ...FORM_VAZIO, data_vencimento: hoje, mes_inicio: mesAtual })
  }

  async function handleSalvar() {
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!form.descricao.trim() || !form.valor || isNaN(valor)) return

    // Validações extras
    if ((form.tipo === 'unica' || form.tipo === 'parcelada') && !form.data_vencimento) return
    if (form.tipo === 'parcelada' && !form.total_parcelas) return
    if (form.tipo === 'fixa_mensal') {
      if (!form.dia_vencimento || !form.mes_inicio || !form.mes_fim) return
      if (form.mes_fim < form.mes_inicio) return
    }
    if (form.parcela_atual && form.total_parcelas && parseInt(form.parcela_atual) > parseInt(form.total_parcelas)) return

    setSalvando(true)
    let sucesso = false

    try {
      if (editandoConta) {
        // Edição: sempre conta única
        await fetch('/api/contas-pagar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editandoConta.id,
            descricao: form.descricao, fornecedor: form.fornecedor,
            categoria: form.categoria, valor,
            data_vencimento: form.data_vencimento,
            parcela_atual: form.parcela_atual ? parseInt(form.parcela_atual) : null,
            total_parcelas: form.total_parcelas ? parseInt(form.total_parcelas) : null,
          }),
        })
      } else if (form.tipo === 'parcelada') {
        // Conta parcelada: cria apenas a 1ª parcela — demais geradas automaticamente pelo cron/lazy
        await fetch('/api/contas-pagar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: form.descricao, fornecedor: form.fornecedor,
            categoria: form.categoria, valor, tipo: 'parcelada',
            data_vencimento: form.data_vencimento,
            parcela_atual: 1,
            total_parcelas: parseInt(form.total_parcelas),
          }),
        })
      } else if (form.tipo === 'fixa_mensal') {
        // Gera um registro por mês
        const meses = gerarMeses(form.mes_inicio, form.mes_fim)
        const dia = String(parseInt(form.dia_vencimento)).padStart(2, '0')
        for (const mes of meses) {
          await fetch('/api/contas-pagar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              descricao: form.descricao, fornecedor: form.fornecedor,
              categoria: form.categoria, valor,
              data_vencimento: `${mes}-${dia}`,
            }),
          })
        }
      } else {
        // Conta única
        await fetch('/api/contas-pagar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: form.descricao, fornecedor: form.fornecedor,
            categoria: form.categoria, valor,
            data_vencimento: form.data_vencimento,
            parcela_atual: form.parcela_atual ? parseInt(form.parcela_atual) : null,
            total_parcelas: form.total_parcelas ? parseInt(form.total_parcelas) : null,
          }),
        })
      }
      sucesso = true
    } catch {
      // mantém formulário aberto em caso de erro
    } finally {
      setSalvando(false)
    }

    if (sucesso) {
      // 50ms garante que o browser finalize limpeza do picker nativo antes do React desmontar.
      // setTimeout(0) era insuficiente em Chrome mobile, Safari e Firefox onde o picker
      // demora mais para fechar, causando o NotFoundError: removeChild no usuário financeiro.
      setTimeout(() => {
        fecharForm()
        loadContas()
      }, 50)
    }
  }

  async function handlePagar(id: number) {
    await fetch('/api/contas-pagar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pagar: true }),
    })
    loadContas()
  }

  async function handleExcluir(id: number) {
    await fetch(`/api/contas-pagar?id=${id}`, { method: 'DELETE' })
    setConfirmExcluir(null)
    loadContas()
  }

  function abrirEdicao(c: ContaPagar) {
    setEditandoConta(c)
    setAdicionando(true)
    setForm({
      ...FORM_VAZIO,
      tipo: 'unica',
      descricao: c.descricao, fornecedor: c.fornecedor, categoria: c.categoria,
      valor: String(c.valor), data_vencimento: c.data_vencimento,
      parcela_atual: c.parcela_atual != null ? String(c.parcela_atual) : '',
      total_parcelas: c.total_parcelas != null ? String(c.total_parcelas) : '',
    })
  }

  const totalPagar   = contas.filter(c => c.status !== 'pago').reduce((s, c) => s + Number(c.valor), 0)
  const totalVencido = contas.filter(c => c.status === 'vencido').reduce((s, c) => s + Number(c.valor), 0)
  const totalAvencer = contas.filter(c => c.status === 'a_vencer').reduce((s, c) => s + Number(c.valor), 0)
  const totalPago    = contas.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor), 0)

  const parcelasInvalidas = !!(form.parcela_atual && form.total_parcelas && parseInt(form.parcela_atual) > parseInt(form.total_parcelas))
  const mesInvalido = form.tipo === 'fixa_mensal' && form.mes_fim && form.mes_inicio && form.mes_fim < form.mes_inicio
  const qtdMeses = form.tipo === 'fixa_mensal' && form.mes_inicio && form.mes_fim && !mesInvalido
    ? gerarMeses(form.mes_inicio, form.mes_fim).length : 0

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Confirm excluir (sem confirm() nativo para evitar bugs de DOM) */}
      {confirmExcluir !== null && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-80 shadow-2xl">
            <p className="text-white font-semibold mb-1">Excluir conta?</p>
            <p className="text-zinc-400 text-sm mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmExcluir(null)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors">Cancelar</button>
              <button onClick={() => handleExcluir(confirmExcluir)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-orange-500/10">
            <CreditCard className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">Contas a Pagar</h2>
            <p className="text-zinc-500 text-xs">Gestão de compromissos financeiros</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdicionando(true); setEditandoConta(null); setForm({ ...FORM_VAZIO, data_vencimento: hoje, mes_inicio: mesAtual }) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 text-sm font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Conta
          </button>
          <button onClick={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
            setTimeout(onClose, 50)
          }} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Total a Pagar', value: totalPagar,   color: '#F97316', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/10', icon: CreditCard },
            { label: 'Vencido',       value: totalVencido, color: '#EF4444', colorClass: 'text-red-400',    bgClass: 'bg-red-500/10',    icon: XCircle },
            { label: 'A Vencer',      value: totalAvencer, color: '#3B82F6', colorClass: 'text-blue-400',   bgClass: 'bg-blue-500/10',   icon: Clock },
            { label: 'Pago no Período', value: totalPago,  color: '#10B981', colorClass: 'text-emerald-400',bgClass: 'bg-emerald-500/10',icon: CheckCircle2 },
          ].map(k => (
            <div key={k.label} className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-4" style={{ borderTopColor: k.color }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{k.label}</p>
                <div className={`p-1.5 rounded-lg ${k.bgClass}`}><k.icon className={`w-3.5 h-3.5 ${k.colorClass}`} /></div>
              </div>
              <p className={`font-bold text-xl ${k.colorClass}`}>{formatCurrency(k.value)}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-zinc-500 text-xs whitespace-nowrap">De</label>
              <input type="date" value={filtroInicio} onChange={e => { const v = e.target.value; setTimeout(() => setFiltroInicio(v), 0) }}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500" />
              <label className="text-zinc-500 text-xs">até</label>
              <input type="date" value={filtroFim} onChange={e => { const v = e.target.value; setTimeout(() => setFiltroFim(v), 0) }}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500" />
            </div>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500">
              <option value="">Todos os status</option>
              <option value="a_vencer">A vencer</option>
              <option value="vencido">Vencido</option>
              <option value="pago">Pago</option>
            </select>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500">
              <option value="">Todas as categorias</option>
              {CONTA_CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <button onClick={loadContas} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs transition-colors">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
            <span className="text-zinc-600 text-xs ml-auto">{contas.length} conta{contas.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Formulário */}
        {adicionando && (
          <div className="bg-zinc-900 border border-orange-500/30 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4">{editandoConta ? 'Editar Conta' : 'Nova Conta a Pagar'}</h3>

            {/* Tipo — só exibe na criação */}
            {!editandoConta && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['unica', 'parcelada', 'fixa_mensal'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.tipo === t ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'}`}>
                    {t === 'unica' ? 'Conta única' : t === 'parcelada' ? 'Parcelada' : 'Fixa mensal'}
                  </button>
                ))}
                {form.tipo === 'parcelada' && (
                  <span className="text-zinc-500 text-xs ml-1">Parcela 1 criada agora — próximas geradas automaticamente todo mês</span>
                )}
                {form.tipo === 'fixa_mensal' && (
                  <span className="text-zinc-500 text-xs ml-1">Gera um lançamento por mês automaticamente</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="xl:col-span-2">
                <label className="text-zinc-500 text-xs mb-1 block">Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Aluguel do escritório" className={inputCls} />
              </div>
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Fornecedor</label>
                <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                  placeholder="Ex: Empresa XYZ" className={inputCls} />
              </div>
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inputCls}>
                  {CONTA_CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Valor *</label>
                {/* inputMode evita o spinner do browser que causa removeChild */}
                <input inputMode="decimal" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="0,00" className={inputCls} />
              </div>

              {/* Campos de conta única */}
              {form.tipo === 'unica' && (
                <>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Vencimento *</label>
                    <input type="date" value={form.data_vencimento} onChange={e => { const v = e.target.value; setTimeout(() => setForm(f => ({ ...f, data_vencimento: v })), 0) }} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Parcela atual</label>
                    <input inputMode="numeric" value={form.parcela_atual} onChange={e => setForm(f => ({ ...f, parcela_atual: e.target.value }))}
                      placeholder="Ex: 1" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Total de parcelas</label>
                    <input inputMode="numeric" value={form.total_parcelas} onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))}
                      placeholder="Ex: 12" className={inputCls} />
                  </div>
                </>
              )}

              {/* Campos de conta parcelada (automática) */}
              {form.tipo === 'parcelada' && (
                <>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">1º Vencimento *</label>
                    <input type="date" value={form.data_vencimento} onChange={e => { const v = e.target.value; setTimeout(() => setForm(f => ({ ...f, data_vencimento: v })), 0) }} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Total de parcelas *</label>
                    <input inputMode="numeric" value={form.total_parcelas} onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))}
                      placeholder="Ex: 12" className={inputCls} />
                  </div>
                </>
              )}

              {/* Campos de fixa mensal */}
              {form.tipo === 'fixa_mensal' && (
                <>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Dia do vencimento *</label>
                    <input inputMode="numeric" value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))}
                      placeholder="Ex: 10" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Mês inicial *</label>
                    <input type="month" value={form.mes_inicio} onChange={e => { const v = e.target.value; setTimeout(() => setForm(f => ({ ...f, mes_inicio: v })), 0) }} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1 block">Mês final *</label>
                    <input type="month" value={form.mes_fim} onChange={e => { const v = e.target.value; setTimeout(() => setForm(f => ({ ...f, mes_fim: v })), 0) }} className={inputCls} />
                  </div>
                </>
              )}
            </div>

            {/* Avisos de validação */}
            {parcelasInvalidas && <p className="text-red-400 text-xs mt-2">A parcela atual não pode ser maior que o total de parcelas.</p>}
            {mesInvalido && <p className="text-red-400 text-xs mt-2">O mês final não pode ser anterior ao mês inicial.</p>}
            {form.tipo === 'fixa_mensal' && qtdMeses > 0 && (
              <p className="text-zinc-500 text-xs mt-2">Serão criados <span className="text-orange-400 font-medium">{qtdMeses} lançamentos</span> (um por mês).</p>
            )}

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleSalvar}
                disabled={salvando || !form.descricao.trim() || !form.valor || parcelasInvalidas || !!mesInvalido ||
                  ((form.tipo === 'unica' || form.tipo === 'parcelada') && !form.data_vencimento) ||
                  (form.tipo === 'parcelada' && !form.total_parcelas) ||
                  (form.tipo === 'fixa_mensal' && (!form.dia_vencimento || !form.mes_inicio || !form.mes_fim))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                <Check className="w-3.5 h-3.5" />
                {salvando ? 'Salvando...' : editandoConta ? 'Salvar' : form.tipo === 'parcelada' ? `Criar parcela 1/${form.total_parcelas || '?'}` : form.tipo === 'fixa_mensal' ? `Criar ${qtdMeses || ''} lançamentos` : 'Adicionar'}
              </button>
              <button onClick={fecharForm} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loadingC ? (
            <div className="p-10 text-center">
              <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Carregando contas...</p>
            </div>
          ) : contas.length === 0 ? (
            <div className="p-10 text-center">
              <CreditCard className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Nenhuma conta encontrada</p>
              <p className="text-zinc-600 text-xs mt-1">Clique em "Nova Conta" para adicionar um compromisso</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Descrição','Fornecedor','Categoria','Valor','Vencimento','Parcela','Status','Pagamento','Ações'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {contas.map(c => {
                    const st = statusLabel(c.status)
                    const vencido = c.status === 'vencido'
                    return (
                      <tr key={c.id} className={`hover:bg-zinc-800/30 transition-colors ${vencido ? 'bg-red-500/5' : ''}`}>
                        <td className="py-3 px-4 text-white text-sm font-medium max-w-[200px] truncate">{c.descricao}</td>
                        <td className="py-3 px-4 text-zinc-400 text-sm whitespace-nowrap">{c.fornecedor || '—'}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full capitalize">{c.categoria}</span>
                        </td>
                        <td className="py-3 px-4 text-white font-semibold text-sm whitespace-nowrap">{formatCurrency(Number(c.valor))}</td>
                        <td className={`py-3 px-4 text-sm whitespace-nowrap ${vencido ? 'text-red-400 font-medium' : 'text-zinc-300'}`}>
                          {new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {c.parcela_atual != null && c.total_parcelas != null ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                                {c.parcela_atual}/{c.total_parcelas}
                              </span>
                              {c.parcelamento_id && (
                                <span title="Parcela automática" className="text-orange-400/70">
                                  <RefreshCw className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          ) : <span className="text-zinc-600 text-sm">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.bg} ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-sm whitespace-nowrap">
                          {c.data_pagamento ? new Date(c.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {c.status !== 'pago' && (
                              <button onClick={() => handlePagar(c.id)} title="Marcar como pago"
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => abrirEdicao(c)} title="Editar"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setConfirmExcluir(c.id)} title="Excluir"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonth(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMesLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${months[m - 1]} ${y}`
}

const CATEGORIAS = [
  { key: 'dept_pessoal',         label: 'Departamento Pessoal' },
  { key: 'comissao_corretor',    label: 'Comissão de Corretor' },
  { key: 'comissao_gerente',     label: 'Comissão de Gerente' },
  { key: 'marketing',            label: 'Marketing' },
  { key: 'servico_terceirizado', label: 'Serviço Terceirizado' },
  { key: 'impostos',             label: 'Impostos' },
  { key: 'taxas_bancarias',      label: 'Taxas Bancárias' },
  { key: 'compra_divida',        label: 'Compra de Dívida' },
  { key: 'despesas_diversas',    label: 'Despesas Diversas' },
  { key: 'devolucao_emprestimo', label: 'Devolução de Empréstimos' },
  { key: 'bonificacao',          label: 'Bonificação' },
  { key: 'pl',                   label: 'PL' },
  // legado
  { key: 'fixa',     label: 'Despesas Fixas' },
  { key: 'variavel', label: 'Despesas Variáveis' },
  { key: 'pix',      label: 'Tarifas Pix' },
  { key: 'pessoal',  label: 'Despesas com Pessoal' },
]

const CATEGORIAS_RECEITA = [
  { key: 'emprestimo_divida', label: 'Empréstimo para Compra de Dívida' },
  { key: 'comissao_banco',    label: 'Comissão de Banco' },
  { key: 'taxa_servico',      label: 'Taxa de Serviço' },
  { key: 'capital_giro',      label: 'Capital de Giro' },
]

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl text-xs space-y-1">
      <p className="text-zinc-400 font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-semibold">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  colorClass,
  bgClass,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
  colorClass: string
  bgClass: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgClass}`}>
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        </div>
      </div>
      <p className="text-white font-bold text-2xl leading-tight">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1 truncate">{sub}</p>}
    </div>
  )
}

// ─── Fluxo de Caixa Modal ────────────────────────────────────────────────────

function FluxoCaixaModal({ mes, onClose }: { mes: string; onClose: () => void }) {
  const [mesSel, setMesSel] = useState(mes)
  const [dias, setDias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingDia, setSavingDia] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, { saldo_real: string; saldo_inicial: string; observacao: string }>>({})
  const [expandedDia, setExpandedDia] = useState<string | null>(null)

  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  function getMesStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  function navMes(delta: number) {
    const [y, m] = mesSel.split('-').map(Number)
    setMesSel(getMesStr(new Date(y, m - 1 + delta, 1)))
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/historico-conciliacoes?mes=${mesSel}`).then(r => r.json()),
      fetch(`/api/fluxo-caixa?mes=${mesSel}`).then(r => r.json()),
    ]).then(([historico, saldos]) => {
      const saldoMap: Record<string, any> = {}
      if (Array.isArray(saldos)) for (const s of saldos) saldoMap[s.data] = s

      const movPorDia: Record<string, any[]> = {}
      if (Array.isArray(historico)) {
        for (const h of historico) {
          const detalhes: any[] = Array.isArray(h.detalhes) ? h.detalhes : []
          for (const d of detalhes) {
            const data: string = d.data || h.created_at?.slice(0, 10) || ''
            if (!data || !data.startsWith(mesSel)) continue
            if (!movPorDia[data]) movPorDia[data] = []
            movPorDia[data].push({ tipo: d.tipo === 'CREDIT' ? 'CREDIT' : 'DEBIT', valor: Math.abs(parseFloat(d.valor) || 0), descricao: d.descricao || '', categoria: d.categoria || '' })
          }
        }
      }

      const [y, m] = mesSel.split('-').map(Number)
      const ultimoDia = new Date(y, m, 0).getDate()
      let saldoAcumulado = 0
      let saldoInicialEncontrado = false
      const allDias: any[] = []

      for (let d = 1; d <= ultimoDia; d++) {
        const dataStr = `${mesSel}-${String(d).padStart(2, '0')}`
        const saldoDb = saldoMap[dataStr]
        const movs = movPorDia[dataStr] || []
        const entradas = movs.filter((m: any) => m.tipo === 'CREDIT').reduce((s: number, m: any) => s + m.valor, 0)
        const saidas = movs.filter((m: any) => m.tipo === 'DEBIT').reduce((s: number, m: any) => s + m.valor, 0)
        if (saldoDb?.saldo_inicial != null && !saldoInicialEncontrado) { saldoAcumulado = parseFloat(saldoDb.saldo_inicial) || 0; saldoInicialEncontrado = true }
        saldoAcumulado = saldoAcumulado + entradas - saidas
        const saldoReal = saldoDb?.saldo_real != null ? parseFloat(saldoDb.saldo_real) : null
        allDias.push({ data: dataStr, entradas, saidas, movimentos: movs, saldo_calculado: saldoAcumulado, saldo_real: saldoReal, saldo_inicial: saldoDb?.saldo_inicial != null ? parseFloat(saldoDb.saldo_inicial) : null, observacao: saldoDb?.observacao || '', divergente: saldoReal !== null && Math.abs(saldoAcumulado - saldoReal) > 0.01 })
      }

      setDias(allDias)
      const ev: Record<string, any> = {}
      for (const d of allDias) ev[d.data] = { saldo_real: d.saldo_real != null ? String(d.saldo_real) : '', saldo_inicial: d.saldo_inicial != null ? String(d.saldo_inicial) : '', observacao: d.observacao }
      setEditValues(ev)
      setLoading(false)
    })
  }, [mesSel])

  async function salvarDia(data: string) {
    const ev = editValues[data]
    if (!ev) return
    setSavingDia(data)
    await fetch('/api/fluxo-caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, saldo_real: ev.saldo_real !== '' ? parseFloat(ev.saldo_real.replace(',', '.')) : null, saldo_inicial: ev.saldo_inicial !== '' ? parseFloat(ev.saldo_inicial.replace(',', '.')) : null, observacao: ev.observacao || null }) })
    setSavingDia(null)
  }

  const mesLabel = new Date(mesSel + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const totalEntradas = dias.reduce((s, d) => s + d.entradas, 0)
  const totalSaidas = dias.reduce((s, d) => s + d.saidas, 0)
  const saldoFinal = dias.length > 0 ? dias[dias.length - 1].saldo_calculado : 0
  const diasDivergentes = dias.filter(d => d.divergente).length

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-semibold text-lg">Fluxo de Caixa</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="px-3 py-1 bg-zinc-900 rounded-lg text-xs font-medium capitalize min-w-[130px] text-center">{mesLabel}</span>
              <button onClick={() => navMes(1)} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-zinc-800">
          <div className="bg-zinc-900 rounded-xl p-3"><p className="text-zinc-500 text-xs">Entradas</p><p className="text-emerald-400 font-bold text-base mt-0.5">{fmt(totalEntradas)}</p></div>
          <div className="bg-zinc-900 rounded-xl p-3"><p className="text-zinc-500 text-xs">Saídas</p><p className="text-red-400 font-bold text-base mt-0.5">{fmt(totalSaidas)}</p></div>
          <div className="bg-zinc-900 rounded-xl p-3"><p className="text-zinc-500 text-xs">Saldo Calculado</p><p className={`font-bold text-base mt-0.5 ${saldoFinal >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(saldoFinal)}</p></div>
          <div className="bg-zinc-900 rounded-xl p-3"><p className="text-zinc-500 text-xs">Divergências</p><p className={`font-bold text-base mt-0.5 ${diasDivergentes > 0 ? 'text-yellow-400' : 'text-zinc-400'}`}>{diasDivergentes} {diasDivergentes === 1 ? 'dia' : 'dias'}</p></div>
        </div>

        {/* Tabela */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">Carregando...</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Data</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">Entradas</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">Saídas</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium">Saldo Calc.</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium w-32">Saldo Inicial</th>
                  <th className="text-right px-4 py-2.5 text-zinc-500 font-medium w-32">Saldo Real</th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Observação</th>
                  <th className="px-4 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {dias.map((dia) => {
                  const ev = editValues[dia.data] || { saldo_real: '', saldo_inicial: '', observacao: '' }
                  const temMov = dia.movimentos.length > 0
                  const dataDisplay = new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  const isExpanded = expandedDia === dia.data
                  return (
                    <>
                      <tr key={dia.data} className={`border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors ${dia.divergente ? 'bg-yellow-500/5' : ''}`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            {dia.divergente ? <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" /> : dia.saldo_real !== null ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <div className="w-3 h-3" />}
                            <button onClick={() => setExpandedDia(isExpanded ? null : dia.data)} className={`font-mono ${temMov ? 'text-white hover:text-emerald-400 cursor-pointer' : 'text-zinc-600'}`}>
                              {dataDisplay}{temMov && <span className="ml-1 text-zinc-500">({dia.movimentos.length})</span>}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">{dia.entradas > 0 ? <span className="text-emerald-400 font-medium">{fmt(dia.entradas)}</span> : <span className="text-zinc-700">—</span>}</td>
                        <td className="px-4 py-2 text-right">{dia.saidas > 0 ? <span className="text-red-400 font-medium">{fmt(dia.saidas)}</span> : <span className="text-zinc-700">—</span>}</td>
                        <td className="px-4 py-2 text-right"><span className={`font-semibold ${dia.saldo_calculado >= 0 ? 'text-zinc-300' : 'text-red-400'}`}>{fmt(dia.saldo_calculado)}</span></td>
                        <td className="px-4 py-2"><input type="text" value={ev.saldo_inicial} onChange={e => setEditValues(prev => ({ ...prev, [dia.data]: { ...ev, saldo_inicial: e.target.value } }))} placeholder="—" className="w-full text-right bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500" /></td>
                        <td className="px-4 py-2"><input type="text" value={ev.saldo_real} onChange={e => setEditValues(prev => ({ ...prev, [dia.data]: { ...ev, saldo_real: e.target.value } }))} placeholder="—" className={`w-full text-right bg-zinc-800 border rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 ${dia.divergente ? 'border-yellow-500/60' : 'border-zinc-700'}`} /></td>
                        <td className="px-4 py-2"><input type="text" value={ev.observacao} onChange={e => setEditValues(prev => ({ ...prev, [dia.data]: { ...ev, observacao: e.target.value } }))} placeholder="—" className="w-full bg-transparent border-b border-zinc-800 px-1 py-1 text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-zinc-600" /></td>
                        <td className="px-4 py-2 text-center"><button onClick={() => salvarDia(dia.data)} disabled={savingDia === dia.data} className="px-2 py-1 rounded text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-50">{savingDia === dia.data ? '...' : 'Salvar'}</button></td>
                      </tr>
                      {isExpanded && dia.movimentos.length > 0 && (
                        <tr key={`${dia.data}-expand`} className="bg-zinc-900/60">
                          <td colSpan={8} className="px-8 py-2">
                            <div className="space-y-1">
                              {dia.movimentos.map((mov: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 py-0.5 border-b border-zinc-800/30 last:border-0">
                                  <span className={`flex-shrink-0 ${mov.tipo === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(mov.valor)}</span>
                                  <span className="text-zinc-400 flex-1 truncate">{mov.descricao || '—'}</span>
                                  {mov.categoria && <span className="text-zinc-600 flex-shrink-0">{mov.categoria}</span>}
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
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [showContasPagar, setShowContasPagar] = useState(false)
  const [showFluxoCaixa, setShowFluxoCaixa] = useState(false)
  const [mes, setMes] = useState(getCurrentMes)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [receitasManuais, setReceitasManuais] = useState<Receita[]>([])
  const [addingReceita, setAddingReceita] = useState<AddingState>(null)
  const [editingReceita, setEditingReceita] = useState<EditingState>(null)
  const [expandedCatsReceita, setExpandedCatsReceita] = useState<Set<string>>(new Set())
  const [receita, setReceita] = useState(0)
  const [metaAdsSpend, setMetaAdsSpend] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<AddingState>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const [saving, setSaving] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [empresaFiltro, setEmpresaFiltro] = useState<Empresa | ''>('')

  // Refs para scroll
  const dreRef = useRef<HTMLDivElement>(null)
  const historicoRef = useRef<HTMLDivElement>(null)

  // OFX
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ofxTxs, setOfxTxs] = useState<OFXTransaction[]>([])
  const [ofxEmpresas, setOfxEmpresas] = useState<Record<string, string>>({})
  const [ofxCats, setOfxCats] = useState<Record<string, OFXCategoria>>({})
  const [ofxDescricoes, setOfxDescricoes] = useState<Record<string, string>>({})
  const [ofxLoading, setOfxLoading] = useState(false)
  const [ofxError, setOfxError] = useState('')
  const [ofxAviso, setOfxAviso] = useState('')
  const [ofxConciliando, setOfxConciliando] = useState(false)
  const [ofxConciliandoFitid, setOfxConciliandoFitid] = useState<string | null>(null)
  const [ofxDone, setOfxDone] = useState(0)
  const [historicoConciliacoes, setHistoricoConciliacoes] = useState<{id: string; created_at: string; mes_referencia: string; qtd_transacoes: number; valor_total: number; detalhes: {despesa_id?: number; descricao: string; categoria: string; valor: number; fitid?: string; tipo?: string; data?: string; mes?: string}[]}[]>([])
  const [historicoExpanded, setHistoricoExpanded] = useState<Set<string>>(new Set())
  const [histFiltro, setHistFiltro] = useState<'hoje' | 'periodo'>('hoje')
  const [histInicio, setHistInicio] = useState(() => new Date().toISOString().slice(0, 10))
  const [histFim, setHistFim] = useState(() => new Date().toISOString().slice(0, 10))
  const [histPage, setHistPage] = useState(1)
  const HIST_PER_PAGE = 15

  // Historical data for chart (last 6 months)
  const [histDespesas, setHistDespesas] = useState<Record<string, number>>({})
  const [histReceita, setHistReceita] = useState<Record<string, number>>({})

  function toggleCat(key: string) {
    setExpandedCats(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  async function loadDespesas(m: string) {
    const r = await fetch(`/api/despesas?mes=${m}`)
    const data = await r.json()
    setDespesas(Array.isArray(data) ? data : [])
  }

  async function loadContratos() {
    const r = await fetch('/api/contratos')
    const data = await r.json()
    const total = Array.isArray(data) ? data.filter((c: { status?: string }) => c.status === 'finalizado').reduce((s: number, c: { taxa?: number }) => s + (c.taxa ?? 0), 0) : 0
    setReceita(total)
  }

  async function loadMetaAds(m: string) {
    try {
      const r = await fetch(`/api/meta-ads?mes=${m}`)
      const data = await r.json()
      setMetaAdsSpend(data.error ? null : (data.spend ?? null))
    } catch {
      setMetaAdsSpend(null)
    }
  }

  async function loadHistorical() {
    try {
      const today = new Date()
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const [dRes, cRes] = await Promise.all([
        fetch('/api/despesas'),
        fetch('/api/contratos'),
      ])
      const allDespesas: Despesa[] = dRes.ok ? await dRes.json() : []
      const allContratos: { taxa?: number; created_at: string; status?: string }[] = (cRes.ok ? await cRes.json() : []).filter((c: { status?: string }) => c.status === 'finalizado')

      const dMap: Record<string, number> = {}
      const rMap: Record<string, number> = {}
      months.forEach(m => {
        dMap[m] = Array.isArray(allDespesas)
          ? allDespesas.filter(d => d.mes === m || d.created_at?.slice(0, 7) === m).reduce((s, d) => s + Number(d.valor), 0)
          : 0
        rMap[m] = Array.isArray(allContratos)
          ? allContratos.filter(c => c.created_at?.slice(0, 7) === m).reduce((s, c) => s + (c.taxa ?? 0), 0)
          : 0
      })
      setHistDespesas(dMap)
      setHistReceita(rMap)
    } catch {
      // silent
    }
  }

  async function loadReceitas(m: string) {
    const r = await fetch(`/api/receitas?mes=${m}`)
    const data = await r.json()
    setReceitasManuais(Array.isArray(data) ? data : [])
  }

  async function load(m: string) {
    setLoading(true)
    await Promise.all([loadDespesas(m), loadContratos(), loadMetaAds(m), loadReceitas(m)])
    setLoading(false)
  }

  async function loadHistorico() {
    const r = await fetch('/api/historico-conciliacoes')
    const data = await r.json()
    setHistoricoConciliacoes(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load(mes) }, [mes])
  useEffect(() => { loadHistorical() }, [])
  useEffect(() => { loadHistorico() }, [])

  // Persiste estado OFX no sessionStorage para sobreviver a navegações
  useEffect(() => {
    if (ofxTxs.length > 0) {
      sessionStorage.setItem('ofx_txs', JSON.stringify(ofxTxs))
      sessionStorage.setItem('ofx_cats', JSON.stringify(ofxCats))
      sessionStorage.setItem('ofx_descs', JSON.stringify(ofxDescricoes))
      sessionStorage.setItem('ofx_emps', JSON.stringify(ofxEmpresas))
    }
  }, [ofxTxs, ofxCats, ofxDescricoes, ofxEmpresas])

  // Restaura estado OFX ao montar
  useEffect(() => {
    try {
      const txs = sessionStorage.getItem('ofx_txs')
      if (txs) {
        const parsed = JSON.parse(txs)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOfxTxs(parsed)
          const cats = sessionStorage.getItem('ofx_cats')
          const descs = sessionStorage.getItem('ofx_descs')
          const emps = sessionStorage.getItem('ofx_emps')
          if (cats) setOfxCats(JSON.parse(cats))
          if (descs) setOfxDescricoes(JSON.parse(descs))
          if (emps) setOfxEmpresas(JSON.parse(emps))
        }
      }
    } catch { /* silent */ }
  }, [])

  const despesasFiltradas = (empresaFiltro ? despesas.filter(d => d.empresa === empresaFiltro) : despesas)
    .filter(d => d.categoria !== 'compra_divida')
  const receitasFiltradas = empresaFiltro ? receitasManuais.filter(r => r.empresa === empresaFiltro) : receitasManuais
  const receitaContratosF = empresaFiltro ? 0 : receita // contratos não têm empresa ainda
  const totalDespesas = despesasFiltradas.reduce((s, d) => s + Number(d.valor), 0) + (empresaFiltro ? 0 : (metaAdsSpend ?? 0))
  const totalReceitasManuais = receitasFiltradas.reduce((s, r) => s + Number(r.valor), 0)
  const receitaTotal = receitaContratosF + totalReceitasManuais
  const lucro = receitaTotal - totalDespesas
  const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0
  const isPositive = lucro >= 0

  // ── Chart data ──
  const chartData = useMemo(() => {
    const today = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(m => ({
      mes: mesLabelCurto(m + '-01'),
      Receita: histReceita[m] ?? 0,
      Despesas: histDespesas[m] ?? 0,
      Lucro: (histReceita[m] ?? 0) - (histDespesas[m] ?? 0),
    }))
  }, [histReceita, histDespesas])

  // ── CRUD ──
  async function handleAdd(categoria: string) {
    if (!adding || saving || !adding.descricao.trim()) return
    setSaving(true)
    await fetch('/api/despesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: adding.descricao, categoria, valor: parseFloat(adding.valor) || 0, mes, empresa: adding.empresa || empresaFiltro || 'BPX' }),
    })
    setSaving(false)
    setAdding(null)
    loadDespesas(mes)
  }

  async function handleEdit() {
    if (!editing || saving) return
    setSaving(true)
    await fetch('/api/despesas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, descricao: editing.descricao, valor: parseFloat(editing.valor) || 0 }),
    })
    setSaving(false)
    setEditing(null)
    loadDespesas(mes)
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta despesa?')) return
    await fetch(`/api/despesas?id=${id}`, { method: 'DELETE' })
    // also remove any historico_conciliacoes record that references this despesa
    const linked = historicoConciliacoes.filter(h => h.detalhes?.some(d => d.despesa_id === id))
    for (const h of linked) {
      await fetch(`/api/historico-conciliacoes?id=${h.id}`, { method: 'DELETE' })
    }
    if (linked.length > 0) loadHistorico()
    loadDespesas(mes)
  }

  // ── CRUD Receitas ──
  async function handleAddReceita(categoria: string) {
    if (!addingReceita || saving || !addingReceita.descricao.trim()) return
    setSaving(true)
    await fetch('/api/receitas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: addingReceita.descricao, categoria, valor: parseFloat(addingReceita.valor) || 0, mes, empresa: addingReceita.empresa || empresaFiltro || 'BPX' }),
    })
    setSaving(false)
    setAddingReceita(null)
    loadReceitas(mes)
  }

  async function handleEditReceita() {
    if (!editingReceita || saving) return
    setSaving(true)
    await fetch('/api/receitas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingReceita.id, descricao: editingReceita.descricao, valor: parseFloat(editingReceita.valor) || 0 }),
    })
    setSaving(false)
    setEditingReceita(null)
    loadReceitas(mes)
  }

  async function handleDeleteReceita(id: number) {
    if (!confirm('Excluir esta receita?')) return
    await fetch(`/api/receitas?id=${id}`, { method: 'DELETE' })
    loadReceitas(mes)
  }

  // ── OFX ──
  async function handleOFXUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOfxLoading(true)
    setOfxError('')
    setOfxTxs([])
    setOfxCats({})
    setOfxDescricoes({})
    setOfxEmpresas({})
    setOfxDone(0)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/ofx', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) { setOfxError(json.error); setOfxLoading(false); return }
      const allTxs: OFXTransaction[] = json.transactions ?? []
      // Filtra FITIDs já conciliados no histórico
      const fitidsConciliados = new Set(
        historicoConciliacoes.flatMap(h => (h.detalhes ?? []).map(d => d.fitid).filter(Boolean))
      )
      const txs = allTxs.filter(t => !fitidsConciliados.has(t.fitid))
      const jaExistiam = allTxs.length - txs.length
      if (jaExistiam > 0) setOfxAviso(`${jaExistiam} transação(ões) já conciliada(s) foram ocultadas automaticamente.`)
      else setOfxAviso('')
      setOfxTxs(txs)
      const cats: Record<string, OFXCategoria> = {}
      const descs: Record<string, string> = {}
      const emps: Record<string, string> = {}
      txs.forEach(t => {
        cats[t.fitid] = t.tipo === 'CREDIT' ? 'ignorar' : 'variavel'
        descs[t.fitid] = t.descricao
        emps[t.fitid] = empresaFiltro || 'BPX'
      })
      setOfxCats(cats)
      setOfxDescricoes(descs)
      setOfxEmpresas(emps)
    } catch (err) {
      setOfxError(String(err))
    }
    setOfxLoading(false)
    e.target.value = ''
  }

  async function handleConciliar() {
    const toCreate = ofxTxs.filter(t => ofxCats[t.fitid] && ofxCats[t.fitid] !== 'ignorar')
    if (toCreate.length === 0) return
    setOfxConciliando(true)
    let count = 0
    for (const t of toCreate) {
      await fetch('/api/despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: ofxDescricoes[t.fitid] || t.descricao, categoria: ofxCats[t.fitid], valor: t.valor, mes }),
      })
      count++
    }
    setOfxDone(count)
    await fetch('/api/historico-conciliacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mes_referencia: mes,
        qtd_transacoes: toCreate.length,
        valor_total: toCreate.reduce((s, t) => s + t.valor, 0),
        detalhes: toCreate.map(t => ({ descricao: ofxDescricoes[t.fitid] || t.descricao, categoria: ofxCats[t.fitid], valor: t.valor })),
      }),
    })
    loadHistorico()
    setOfxTxs([])
    setOfxCats({})
    setOfxDescricoes({})
    setOfxEmpresas({})
    setOfxConciliando(false)
    loadDespesas(mes)
  }

  async function handleConciliarUma(t: OFXTransaction) {
    const cat = ofxCats[t.fitid]
    if (!cat || cat === 'ignorar') return
    setOfxConciliandoFitid(t.fitid)
    try {
      // Entradas (CREDIT) ficam só no histórico — não vão pro DRE
      let despesaCriada: Despesa | null = null
      if (t.tipo !== 'CREDIT') {
        const dRes = await fetch('/api/despesas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descricao: ofxDescricoes[t.fitid] || t.descricao, categoria: cat, valor: t.valor, mes, empresa: ofxEmpresas[t.fitid] || 'BPX', data: t.data || null }),
        })
        const despesaJson = await dRes.json()
        if (!dRes.ok) {
          setOfxAviso(`Erro ao salvar despesa: ${despesaJson?.error ?? dRes.status}`)
          return
        }
        despesaCriada = despesaJson
        if (despesaCriada) setDespesas(prev => [...prev, despesaCriada!])
      }
      await fetch('/api/historico-conciliacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes_referencia: mes,
          qtd_transacoes: 1,
          valor_total: t.valor,
          detalhes: [{
            despesa_id: despesaCriada?.id ?? null,
            descricao: ofxDescricoes[t.fitid] || t.descricao,
            categoria: cat,
            valor: t.valor,
            fitid: t.fitid,
            tipo: t.tipo,
            data: t.data,
            mes: t.mes,
          }],
        }),
      })
      setOfxTxs(prev => {
        const restantes = prev.filter(x => x.fitid !== t.fitid)
        if (restantes.length === 0) {
          sessionStorage.removeItem('ofx_txs')
          sessionStorage.removeItem('ofx_cats')
          sessionStorage.removeItem('ofx_descs')
          sessionStorage.removeItem('ofx_emps')
        }
        return restantes
      })
      setOfxDone(prev => prev + 1)
      loadDespesas(mes)
      loadHistorico()
    } finally {
      setOfxConciliandoFitid(null)
    }
  }

  const ofxParaConciliar = ofxTxs.filter(t => ofxCats[t.fitid] !== 'ignorar').length

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {showContasPagar && <ContasPagarModal onClose={() => setShowContasPagar(false)} />}
      {showFluxoCaixa && <FluxoCaixaModal mes={mes} onClose={() => setShowFluxoCaixa(false)} />}

      <Header title="Financeiro" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── NAVEGAÇÃO DE MÊS ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMes(m => addMonth(m, -1))}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-base min-w-[160px] text-center">
            {formatMesLabel(mes)}
          </span>
          <button
            onClick={() => setMes(m => addMonth(m, 1))}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {loading && <span className="text-zinc-500 text-xs animate-pulse">Carregando...</span>}
          <div className="flex items-center gap-1 ml-4">
            {(['', ...EMPRESAS] as const).map(e => (
              <button
                key={e || 'todas'}
                onClick={() => setEmpresaFiltro(e as Empresa | '')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${empresaFiltro === e ? 'bg-orange-500 border-orange-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-orange-500/50 hover:text-orange-300'}`}
              >
                {e || 'Todas'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowFluxoCaixa(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 text-sm font-medium transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              Fluxo de Caixa
            </button>
            <button
              onClick={() => setShowContasPagar(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-400 text-sm font-medium transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Contas a Pagar
            </button>
          </div>
        </div>

        {/* ── ALERTAS ── */}
        {!loading && (totalDespesas > receita && receita > 0 || lucro < 0) && (
          <div className="space-y-2">
            {totalDespesas > receita && receita > 0 && (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-yellow-300 text-sm">
                  Atenção: as despesas ({formatCurrency(totalDespesas)}) superam a receita ({formatCurrency(receita)}) em {formatMesLabel(mes)}.
                </p>
              </div>
            )}
            {lucro < 0 && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">
                  Lucro negativo em {formatMesLabel(mes)}: {formatCurrency(lucro)}. Revise as despesas ou aumente a receita.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── KPI CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label={KPI_LABELS.receita}
            value={formatCurrency(receitaTotal)}
            sub={`contratos + ${receitasManuais.length} receita${receitasManuais.length !== 1 ? 's' : ''} manual${receitasManuais.length !== 1 ? 'is' : ''}`}
            icon={DollarSign}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label={KPI_LABELS.despesasTotal}
            value={formatCurrency(totalDespesas)}
            sub={`${despesas.length} lançamento${despesas.length !== 1 ? 's' : ''} em ${formatMesLabel(mes)}`}
            icon={TrendingDown}
            color="#EF4444"
            colorClass="text-red-400"
            bgClass="bg-red-500/10"
          />
          <KpiCard
            label={KPI_LABELS.lucro}
            value={formatCurrency(lucro)}
            sub="receita menos despesas"
            icon={isPositive ? TrendingUp : TrendingDown}
            color={isPositive ? '#10B981' : '#EF4444'}
            colorClass={isPositive ? 'text-emerald-400' : 'text-red-400'}
            bgClass={isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
          <KpiCard
            label={KPI_LABELS.margem}
            value={`${margem.toFixed(1).replace('.', ',')}%`}
            sub="lucro / receita"
            icon={Percent}
            color={isPositive ? '#10B981' : '#EF4444'}
            colorClass={isPositive ? 'text-emerald-400' : 'text-red-400'}
            bgClass={isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
        </div>

        {/* ── GRÁFICO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-5">Evolução Mensal — Últimos 6 Meses</h3>
          <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
              <linearGradient id="finGradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="finGradRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="finGradViolet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 12 }} />
              <Area type="monotone" dataKey="Receita" stroke="#10B981" strokeWidth={2} fill="url(#finGradGreen)" dot={false} activeDot={{ r: 4, fill: '#10B981' }} />
              <Area type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} fill="url(#finGradRed)" dot={false} activeDot={{ r: 4, fill: '#EF4444' }} />
              <Area type="monotone" dataKey="Lucro" stroke="#8B5CF6" strokeWidth={2} fill="url(#finGradViolet)" dot={false} activeDot={{ r: 4, fill: '#8B5CF6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── DRE ── */}
        <div ref={dreRef} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-white font-semibold text-base">DRE — {formatMesLabel(mes)}</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Demonstrativo de Resultado do Exercício</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Carregando...</div>
          ) : (
            <div className="p-6 space-y-6">

              {/* RECEITAS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Receitas</p>
                  <span className="text-emerald-400 font-bold text-sm">{formatCurrency(receitaTotal)}</span>
                </div>
                <div className="space-y-0.5">
                  {receitaContratosF > 0 && (
                    <div className="flex items-center justify-between py-1.5 px-2">
                      <span className="text-zinc-400 text-sm">Taxas de Contratos</span>
                      <span className="text-zinc-300 text-sm font-medium">{formatCurrency(receitaContratosF)}</span>
                    </div>
                  )}
                  {CATEGORIAS_RECEITA.map(({ key, label }) => {
                    const items = receitasFiltradas.filter(r => r.categoria === key)
                    const subtotal = items.reduce((s, r) => s + Number(r.valor), 0)
                    const isExp = expandedCatsReceita.has(key)
                    const isAddingThis = addingReceita?.categoria === key
                    return (
                      <div key={key}>
                        <button
                          onClick={() => { setExpandedCatsReceita(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }); setAddingReceita(null) }}
                          className="w-full flex items-center justify-between py-1.5 hover:bg-zinc-800/40 rounded-lg px-2 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`text-sm ${subtotal > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>{label}</span>
                            {items.length > 0 && <span className="text-zinc-600 text-xs">{items.length}</span>}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${subtotal > 0 ? 'text-zinc-300' : 'text-zinc-700'}`}>{formatCurrency(subtotal)}</span>
                            {isExp ? <ChevronUp className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />}
                          </span>
                        </button>
                        {isExp && (
                          <div className="ml-4 space-y-0.5 mt-1 mb-2">
                            {items.map(r => (
                              <div key={r.id} className="flex items-center justify-between py-1 group">
                                {editingReceita?.id === r.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <input value={editingReceita.descricao} onChange={e => setEditingReceita(s => s ? { ...s, descricao: e.target.value } : s)} className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                    <input type="number" value={editingReceita.valor} onChange={e => setEditingReceita(s => s ? { ...s, valor: e.target.value } : s)} className="w-24 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                    <button onClick={handleEditReceita} disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setEditingReceita(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-zinc-500 text-xs flex-1">{r.descricao}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-zinc-400 text-xs font-medium">{formatCurrency(Number(r.valor))}</span>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingReceita({ id: r.id, descricao: r.descricao, valor: String(r.valor) })} className="text-zinc-600 hover:text-white"><Pencil className="w-3 h-3" /></button>
                                        <button onClick={() => handleDeleteReceita(r.id)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {isAddingThis ? (
                              <div className="flex items-center gap-2 py-1">
                                <input autoFocus value={addingReceita.descricao} onChange={e => setAddingReceita(s => s ? { ...s, descricao: e.target.value } : s)} placeholder="Descrição" className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                <input type="number" value={addingReceita.valor} onChange={e => setAddingReceita(s => s ? { ...s, valor: e.target.value } : s)} placeholder="0,00" className="w-24 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                <button onClick={() => handleAddReceita(key)} disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setAddingReceita(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <button onClick={() => setAddingReceita({ categoria: key, descricao: '', valor: '', empresa: empresaFiltro || 'BPX' })} className="flex items-center gap-1.5 text-zinc-600 hover:text-emerald-400 text-xs transition-colors py-1">
                                <Plus className="w-3 h-3" />Adicionar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* DESPESAS POR CATEGORIA */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Despesas por Categoria</p>
                  <span className="text-red-400 font-bold text-sm">{formatCurrency(totalDespesas)}</span>
                </div>

                {/* Barra visual empilhada */}
                {totalDespesas > 0 && (() => {
                  const BAR_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#14b8a6','#f59e0b','#84cc16','#3b82f6']
                  const cats = [
                    ...(metaAdsSpend && !empresaFiltro ? [{ key: '__marketing__', valor: metaAdsSpend }] : []),
                    ...CATEGORIAS.map(({ key }) => ({ key, valor: despesasFiltradas.filter(d => d.categoria === key).reduce((s, d) => s + Number(d.valor), 0) })).filter(c => c.valor > 0),
                  ].sort((a, b) => b.valor - a.valor)
                  return (
                    <div className="flex h-3 rounded-full overflow-hidden mb-5">
                      {cats.map((c, i) => (
                        <div key={c.key} style={{ width: `${(c.valor / totalDespesas) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                      ))}
                    </div>
                  )
                })()}

                <div className="space-y-1">
                  {/* Marketing auto */}
                  {metaAdsSpend !== null && !empresaFiltro && (
                    <div>
                      <button onClick={() => toggleCat('__marketing__')} className="w-full flex items-center gap-3 py-2 hover:bg-zinc-800/40 rounded-lg px-2 transition-colors">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f97316' }} />
                        <span className="text-zinc-300 text-sm flex-1 text-left">Marketing</span>
                        <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">auto</span>
                        <div className="w-24 mx-2 bg-zinc-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min((metaAdsSpend / totalDespesas) * 100, 100)}%`, background: '#f97316', opacity: 0.7 }} />
                        </div>
                        <span className="text-zinc-500 text-xs w-10 text-right">{totalDespesas > 0 ? ((metaAdsSpend / totalDespesas) * 100).toFixed(0) : 0}%</span>
                        <span className="text-zinc-300 text-sm font-medium w-28 text-right">{formatCurrency(metaAdsSpend)}</span>
                        {expandedCats.has('__marketing__') ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                      </button>
                      {expandedCats.has('__marketing__') && (
                        <div className="ml-8 py-1 mb-1">
                          <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-500 text-xs">Facebook Ads</span>
                            <span className="text-zinc-400 text-xs">{formatCurrency(metaAdsSpend)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Categorias DRE ordenadas por valor */}
                  {(() => {
                    const BAR_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#14b8a6','#f59e0b','#84cc16','#3b82f6']
                    const colorOffset = (metaAdsSpend && !empresaFiltro) ? 1 : 0
                    return [...CATEGORIAS]
                      .map(({ key, label }) => ({
                        key, label,
                        items: despesasFiltradas.filter(d => d.categoria === key),
                        subtotal: despesasFiltradas.filter(d => d.categoria === key).reduce((s, d) => s + Number(d.valor), 0),
                      }))
                      .sort((a, b) => b.subtotal - a.subtotal)
                      .map(({ key, label, items, subtotal }, idx) => {
                        const isExpanded = expandedCats.has(key)
                        const isAddingThis = adding?.categoria === key
                        const pct = totalDespesas > 0 ? (subtotal / totalDespesas) * 100 : 0
                        const color = BAR_COLORS[(idx + colorOffset) % BAR_COLORS.length]
                        return (
                          <div key={key}>
                            <button
                              onClick={() => { toggleCat(key); setAdding(null) }}
                              className={`w-full flex items-center gap-3 py-2 hover:bg-zinc-800/40 rounded-lg px-2 transition-colors ${subtotal === 0 ? 'opacity-25' : ''}`}
                            >
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                              <span className="text-zinc-300 text-sm flex-1 text-left">{label}</span>
                              {items.length > 0 && <span className="text-zinc-600 text-xs">{items.length}</span>}
                              <div className="w-24 mx-2 bg-zinc-800 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                              </div>
                              <span className="text-zinc-500 text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                              <span className={`text-sm font-medium w-28 text-right ${subtotal > 0 ? 'text-zinc-300' : 'text-zinc-700'}`}>{formatCurrency(subtotal)}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                            </button>
                            {isExpanded && (
                              <div className="ml-8 space-y-0.5 mt-1 mb-2">
                                {items.map(d => (
                                  <div key={d.id} className="flex items-center justify-between py-1 group">
                                    {editing?.id === d.id ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <input value={editing.descricao} onChange={e => setEditing(s => s ? { ...s, descricao: e.target.value } : s)} className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                        <input type="number" value={editing.valor} onChange={e => setEditing(s => s ? { ...s, valor: e.target.value } : s)} className="w-24 bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                        <button onClick={handleEdit} disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-zinc-500 text-xs flex-1">
                                          {d.data && <span className="text-zinc-600 mr-1">{d.data.slice(8,10)}/{d.data.slice(5,7)}</span>}
                                          {d.descricao}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-zinc-400 text-xs font-medium">{formatCurrency(Number(d.valor))}</span>
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditing({ id: d.id, descricao: d.descricao, valor: String(d.valor) })} className="text-zinc-600 hover:text-white"><Pencil className="w-3 h-3" /></button>
                                            <button onClick={() => handleDelete(d.id)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                                {isAddingThis ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <input autoFocus value={adding.descricao} onChange={e => setAdding(s => s ? { ...s, descricao: e.target.value } : s)} placeholder="Descrição" className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                    <input type="number" value={adding.valor} onChange={e => setAdding(s => s ? { ...s, valor: e.target.value } : s)} placeholder="0,00" className="w-24 bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500" />
                                    <button onClick={() => handleAdd(key)} disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setAdding(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => setAdding({ categoria: key, descricao: '', valor: '', empresa: empresaFiltro || 'BPX' })} className="flex items-center gap-1.5 text-zinc-600 hover:text-emerald-400 text-xs transition-colors py-1">
                                    <Plus className="w-3 h-3" />Adicionar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                  })()}
                </div>
              </div>

              {/* RESULTADO */}
              <div className="border-t border-zinc-800 pt-4 space-y-1">
                <div className="flex items-center justify-between py-1.5 px-2">
                  <span className="text-zinc-400 text-sm">Total Receitas</span>
                  <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(receitaTotal)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 px-2">
                  <span className="text-zinc-400 text-sm">Total Despesas</span>
                  <span className="text-red-400 font-semibold text-sm">{formatCurrency(totalDespesas)}</span>
                </div>
                <div className={`flex items-center justify-between py-3 px-4 rounded-xl mt-2 ${isPositive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-base">Lucro Líquido</span>
                    <span className="text-zinc-500 text-xs">margem {margem.toFixed(1).replace('.', ',')}%</span>
                  </div>
                  <span className={`font-bold text-lg ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(lucro)}</span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── DISTRIBUIÇÃO DE LUCRO ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <Users className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <h3 className="text-white font-semibold text-sm">Distribuição do Lucro — {formatMesLabel(mes)}</h3>
          </div>
          <div className="space-y-3">
            {calcularDistribuicaoLucro(lucro).map(({ nome, percentual, valor }) => (
              <div key={nome} className="flex items-center gap-4">
                <span className="text-zinc-300 text-sm w-20 shrink-0">{nome}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isPositive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                    style={{ width: `${percentual}%` }}
                  />
                </div>
                <span className="text-zinc-500 text-xs w-10 text-right shrink-0">{percentual}%</span>
                <span className={`font-semibold text-sm w-28 text-right shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CONCILIAÇÃO BANCÁRIA OFX ── */}
        <div data-ofx-section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                Conciliação Bancária — Extrato OFX
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">Importe o extrato do banco para lançar despesas automaticamente no DRE</p>
            </div>
            <div className="flex items-center gap-2">
              {ofxDone > 0 && (
                <span className="text-emerald-400 text-xs font-medium">{ofxDone} despesa{ofxDone > 1 ? 's' : ''} adicionada{ofxDone > 1 ? 's' : ''} ✓</span>
              )}
              <input ref={fileInputRef} type="file" accept=".ofx,.OFX" onChange={handleOFXUpload} className="hidden" />
              <button
                onClick={() => { setOfxDone(0); fileInputRef.current?.click() }}
                disabled={ofxLoading}
                className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {ofxLoading ? 'Processando...' : 'Importar .OFX'}
              </button>
            </div>
          </div>

          {ofxError && (
            <div className="px-6 py-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/5 border-b border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {ofxError}
            </div>
          )}
          {ofxAviso && (
            <div className="px-6 py-4 flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/5 border-b border-yellow-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {ofxAviso}
            </div>
          )}

          {ofxTxs.length > 0 ? (
            <div className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-zinc-400 text-sm">
                  <span className="text-white font-semibold">{ofxTxs.length}</span> transações de <span className="text-white font-semibold">{formatMesLabel(mes)}</span>
                  {ofxParaConciliar > 0 && <span className="text-emerald-400"> · {ofxParaConciliar} serão lançadas</span>}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setOfxTxs([]); setOfxCats({}); setOfxDescricoes({}); setOfxEmpresas({}); setOfxAviso(''); sessionStorage.removeItem('ofx_txs'); sessionStorage.removeItem('ofx_cats'); sessionStorage.removeItem('ofx_descs'); sessionStorage.removeItem('ofx_emps') }} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
                <button onClick={() => setOfxCats(prev => { const n = { ...prev }; ofxTxs.forEach(t => { if (t.tipo !== 'CREDIT') n[t.fitid] = 'variavel' }); return n })} className="hover:text-zinc-300 transition-colors underline">Selecionar todos débitos</button>
                <button onClick={() => setOfxCats(prev => { const n = { ...prev }; ofxTxs.forEach(t => { n[t.fitid] = 'ignorar' }); return n })} className="hover:text-zinc-300 transition-colors underline">Ignorar todos</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left">
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Data</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2">Descrição</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Tipo</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap text-right">Valor</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Categoria DRE</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap">Empresa</th>
                      <th className="text-zinc-500 text-xs font-medium py-2 px-2 whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {ofxTxs.map(t => {
                      const cat = ofxCats[t.fitid] ?? 'ignorar'
                      const isIgnored = cat === 'ignorar'
                      return (
                        <tr key={t.fitid} className={`transition-colors ${isIgnored ? 'opacity-40' : ''}`}>
                          <td className="py-2 px-2 text-zinc-400 text-xs whitespace-nowrap">{t.data}</td>
                          <td className="py-2 px-2">
                            <input
                              value={ofxDescricoes[t.fitid] ?? t.descricao}
                              onChange={e => setOfxDescricoes(prev => ({ ...prev, [t.fitid]: e.target.value }))}
                              className="w-full bg-transparent text-zinc-300 text-xs focus:outline-none focus:text-white border-b border-transparent focus:border-zinc-600 transition-colors"
                            />
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className={`text-xs font-medium ${t.tipo === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.tipo === 'CREDIT' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap text-right">
                            <span className={`text-sm font-semibold ${t.tipo === 'CREDIT' ? 'text-emerald-400' : 'text-white'}`}>
                              {t.tipo === 'CREDIT' ? '+' : '-'}{formatCurrency(t.valor)}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={cat}
                              onChange={e => setOfxCats(prev => ({ ...prev, [t.fitid]: e.target.value as OFXCategoria }))}
                              className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                            >
                              <option value="ignorar">Ignorar</option>
                              {CATEGORIAS.filter(c => !['fixa','variavel','pix','pessoal'].includes(c.key)).map(c => (
                                <option key={c.key} value={c.key}>{c.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={ofxEmpresas[t.fitid] ?? empresaFiltro ?? 'BPX'}
                              onChange={e => setOfxEmpresas(prev => ({ ...prev, [t.fitid]: e.target.value }))}
                              disabled={isIgnored}
                              className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                            >
                              {EMPRESAS.map(emp => (
                                <option key={emp} value={emp}>{emp}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => handleConciliarUma(t)}
                              disabled={isIgnored || ofxConciliandoFitid === t.fitid}
                              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Check className="w-3 h-3" />
                              Conciliar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <Upload className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhum extrato carregado</p>
              <p className="text-zinc-600 text-xs mt-1">Importe um arquivo .OFX do seu banco para fazer a conciliação de {formatMesLabel(mes)}</p>
            </div>
          )}
        </div>

        {/* ── HISTÓRICO DE CONCILIAÇÕES ── */}
        {(() => {
          const hoje = new Date().toISOString().slice(0, 10)
          const histFiltrados = historicoConciliacoes.filter(h => {
            const dia = h.created_at.slice(0, 10)
            if (histFiltro === 'hoje') return dia === hoje
            return dia >= histInicio && dia <= histFim
          })
          const histTotal = histFiltrados.length
          const histPages = Math.max(1, Math.ceil(histTotal / HIST_PER_PAGE))
          const histPagina = histFiltrados.slice((histPage - 1) * HIST_PER_PAGE, histPage * HIST_PER_PAGE)
          return (
            <div ref={historicoRef} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-white font-semibold text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-400" />
                      Histórico de Conciliações
                    </h3>
                    <p className="text-zinc-500 text-xs mt-0.5">Registro das conciliações OFX realizadas</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => { setHistFiltro('hoje'); setHistPage(1) }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${histFiltro === 'hoje' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-orange-500/50 hover:text-orange-300'}`}
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => { setHistFiltro('periodo'); setHistPage(1) }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${histFiltro === 'periodo' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-orange-500/50 hover:text-orange-300'}`}
                    >
                      Por período
                    </button>
                    {histFiltro === 'periodo' && (
                      <>
                        <input
                          type="date"
                          value={histInicio}
                          onChange={e => { setHistInicio(e.target.value); setHistPage(1) }}
                          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500"
                        />
                        <span className="text-zinc-600 text-xs">até</span>
                        <input
                          type="date"
                          value={histFim}
                          onChange={e => { setHistFim(e.target.value); setHistPage(1) }}
                          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500"
                        />
                      </>
                    )}
                    {histTotal > 0 && (
                      <span className="text-zinc-500 text-xs ml-1">{histTotal} registro{histTotal !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>

              {histPagina.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Clock className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">
                    {histFiltro === 'hoje' ? 'Nenhuma conciliação realizada hoje' : 'Nenhuma conciliação no período selecionado'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left">
                          <th className="text-zinc-500 text-xs font-medium py-3 px-4 whitespace-nowrap">Data/hora</th>
                          <th className="text-zinc-500 text-xs font-medium py-3 px-4 whitespace-nowrap">Mês ref.</th>
                          <th className="text-zinc-500 text-xs font-medium py-3 px-4 whitespace-nowrap text-center">Qtd</th>
                          <th className="text-zinc-500 text-xs font-medium py-3 px-4 whitespace-nowrap text-right">Valor</th>
                          <th className="text-zinc-500 text-xs font-medium py-3 px-4 whitespace-nowrap text-center">Detalhes</th>
                          <th className="text-zinc-500 text-xs font-medium py-3 px-4 whitespace-nowrap"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {histPagina.map(h => {
                          const isExpanded = historicoExpanded.has(h.id)
                          // Usa a data do extrato OFX se disponível, senão a data da conciliação
                          const dataExtrato = h.detalhes?.[0]?.data
                          const dataBase = dataExtrato ? dataExtrato + 'T12:00:00' : h.created_at
                          const dataFormatada = dataExtrato
                            ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dataBase))
                            : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dataBase))
                          const [ano, mesNum] = h.mes_referencia.split('-')
                          const mesLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
                            .format(new Date(Number(ano), Number(mesNum) - 1, 1))
                          return (
                            <>
                              <tr key={h.id} className="hover:bg-zinc-800/30 transition-colors">
                                <td className="py-3 px-4 text-zinc-400 text-xs whitespace-nowrap">{dataFormatada}</td>
                                <td className="py-3 px-4 text-zinc-300 text-xs capitalize whitespace-nowrap">{mesLabel}</td>
                                <td className="py-3 px-4 text-zinc-300 text-xs text-center">{h.qtd_transacoes}</td>
                                <td className="py-3 px-4 text-white text-xs font-semibold text-right whitespace-nowrap">{formatCurrency(h.valor_total)}</td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => setHistoricoExpanded(prev => { const n = new Set(prev); n.has(h.id) ? n.delete(h.id) : n.add(h.id); return n })}
                                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={async () => {
                                      for (const d of h.detalhes ?? []) {
                                        if (d.despesa_id) await fetch(`/api/despesas?id=${d.despesa_id}`, { method: 'DELETE' })
                                      }
                                      await fetch(`/api/historico-conciliacoes?id=${h.id}`, { method: 'DELETE' })
                                      const detalhes = h.detalhes ?? []
                                      const txsRestauradas: OFXTransaction[] = detalhes.map((d, i) => ({
                                        fitid: d.fitid || `restored_${h.id}_${i}`,
                                        tipo: d.tipo ?? 'DEBIT',
                                        data: d.data ?? '',
                                        valor: d.valor,
                                        descricao: d.descricao,
                                        mes: d.mes ?? h.mes_referencia,
                                      }))
                                      const newCats: Record<string, OFXCategoria> = {}
                                      const newDescs: Record<string, string> = {}
                                      txsRestauradas.forEach((t, i) => {
                                        newCats[t.fitid] = (detalhes[i]?.categoria as OFXCategoria) ?? 'variavel'
                                        newDescs[t.fitid] = t.descricao
                                      })
                                      setOfxTxs(prev => { const ex = new Set(prev.map(x => x.fitid)); return [...prev, ...txsRestauradas.filter(x => !ex.has(x.fitid))] })
                                      setOfxCats(prev => ({ ...prev, ...newCats }))
                                      setOfxDescricoes(prev => ({ ...prev, ...newDescs }))
                                      setHistoricoConciliacoes(prev => prev.filter(x => x.id !== h.id))
                                      setDespesas(prev => prev.filter(d => !(h.detalhes ?? []).some(det => det.despesa_id === d.id)))
                                    }}
                                    className="text-zinc-600 hover:text-red-400 transition-colors"
                                    title="Excluir e restaurar no OFX"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && Array.isArray(h.detalhes) && h.detalhes.length > 0 && (
                                <tr key={`${h.id}-detail`} className="bg-zinc-950/60">
                                  <td colSpan={6} className="px-6 py-3">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-zinc-800 text-left">
                                          <th className="text-zinc-600 font-medium py-1.5 pr-4">Descrição</th>
                                          <th className="text-zinc-600 font-medium py-1.5 pr-4">Categoria</th>
                                          <th className="text-zinc-600 font-medium py-1.5 text-right">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-800/30">
                                        {h.detalhes.map((d, i) => (
                                          <tr key={i}>
                                            <td className="py-1.5 pr-4 text-zinc-400">{d.descricao}</td>
                                            <td className="py-1.5 pr-4 text-zinc-500 capitalize">{d.categoria}</td>
                                            <td className="py-1.5 text-zinc-300 font-semibold text-right whitespace-nowrap">{formatCurrency(d.valor)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {histPages > 1 && (
                    <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-zinc-500 text-xs">
                        Página {histPage} de {histPages} · {histTotal} registros
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setHistPage(p => Math.max(1, p - 1))}
                          disabled={histPage === 1}
                          className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {Array.from({ length: histPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === histPages || Math.abs(p - histPage) <= 1)
                          .reduce<(number | '...')[]>((acc, p, i, arr) => {
                            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                            acc.push(p)
                            return acc
                          }, [])
                          .map((p, i) => p === '...' ? (
                            <span key={`ellipsis-${i}`} className="text-zinc-600 text-xs px-1">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setHistPage(p as number)}
                              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${histPage === p ? 'bg-orange-500 text-white' : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white'}`}
                            >
                              {p}
                            </button>
                          ))
                        }
                        <button
                          onClick={() => setHistPage(p => Math.min(histPages, p + 1))}
                          disabled={histPage === histPages}
                          className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

      </div>
    </div>
  )
}
