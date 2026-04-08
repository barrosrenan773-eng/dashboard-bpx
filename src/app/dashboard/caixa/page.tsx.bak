'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight,
  Pencil, Trash2, Plus, Check, X,
  Wallet, Briefcase, Lock, TrendingUp, AlertTriangle,
  ArrowRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CaixaRow = {
  id: number
  tipo: 'saldo' | 'item'
  caixa_tipo: 'renan' | 'bpx'
  descricao: string
  valor: number
  mes: string
  created_at: string
}

type StatusCapital =
  | 'em_conta'
  | 'em_operacao'
  | 'aguardando_liquidacao'
  | 'judicializado'
  | 'em_recuperacao'
  | 'transportado'

type ItemForaDoKaixa = {
  id: string
  contrato: string
  cliente: string
  valor: number
  status: StatusCapital
  data_saida: string
  mes_competencia: string
  previsao_retorno: string
  responsavel: string
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
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${months[m - 1]} ${y}`
}

// ─── Status Capital ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StatusCapital, string> = {
  em_conta:              'Em conta',
  em_operacao:           'Em operação',
  aguardando_liquidacao: 'Aguardando liquidação',
  judicializado:         'Judicializado',
  em_recuperacao:        'Em recuperação',
  transportado:          'Transportado p/ próximo mês',
}

const STATUS_STYLE: Record<StatusCapital, string> = {
  em_conta:              'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  em_operacao:           'text-blue-400 bg-blue-500/10 border-blue-500/30',
  aguardando_liquidacao: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  judicializado:         'text-red-400 bg-red-500/10 border-red-500/30',
  em_recuperacao:        'text-orange-400 bg-orange-500/10 border-orange-500/30',
  transportado:          'text-zinc-400 bg-zinc-700/30 border-zinc-600/30',
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, colorClass, bgClass,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; colorClass: string; bgClass: string
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

// ─── CaixaSection ─────────────────────────────────────────────────────────────

type SectionProps = {
  title: string
  caixaTipo: 'renan' | 'bpx'
  mes: string
  rows: CaixaRow[]
  onReload: () => void
}

function CaixaSection({ title, caixaTipo, mes, rows, onReload }: SectionProps) {
  const [saving, setSaving] = useState(false)
  const [editingSaldo, setEditingSaldo] = useState(false)
  const [saldoInput, setSaldoInput] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newValor, setNewValor] = useState('')
  const [editingItem, setEditingItem] = useState<{ id: number; descricao: string; valor: string } | null>(null)

  const saldoRow = rows.find(r => r.tipo === 'saldo')
  const items = rows.filter(r => r.tipo === 'item')
  const saldoTotal = saldoRow ? Number(saldoRow.valor) : 0
  const totalItems = items.reduce((s, i) => s + Number(i.valor), 0)
  const diferenca = saldoTotal - totalItems

  async function handleSaveSaldo() {
    if (saving) return
    setSaving(true)
    const valor = parseFloat(saldoInput) || 0
    if (saldoRow) {
      await fetch('/api/caixa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saldoRow.id, valor }) })
    } else {
      await fetch('/api/caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'saldo', caixa_tipo: caixaTipo, descricao: `Saldo ${title}`, valor, mes }) })
    }
    setSaving(false); setEditingSaldo(false); onReload()
  }

  async function handleAddItem() {
    if (saving || !newDesc.trim()) return
    setSaving(true)
    await fetch('/api/caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: 'item', caixa_tipo: caixaTipo, descricao: newDesc, valor: parseFloat(newValor) || 0, mes }) })
    setSaving(false); setAddingItem(false); setNewDesc(''); setNewValor(''); onReload()
  }

  async function handleEditItem() {
    if (!editingItem || saving) return
    setSaving(true)
    await fetch('/api/caixa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingItem.id, descricao: editingItem.descricao, valor: parseFloat(editingItem.valor) || 0 }) })
    setSaving(false); setEditingItem(null); onReload()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir?')) return
    await fetch(`/api/caixa?id=${id}`, { method: 'DELETE' }); onReload()
  }

  const isRenan = caixaTipo === 'renan'
  const accentColor = isRenan ? '#3B82F6' : '#10B981'
  const accentText = isRenan ? 'text-blue-400' : 'text-emerald-400'
  const accentBg = isRenan ? 'bg-blue-500/10' : 'bg-emerald-500/10'
  const accentBorder = isRenan ? 'border-blue-500/30' : 'border-emerald-500/30'

  const diffAbs = Math.abs(diferenca)
  const diffTextColor = diffAbs === 0 ? 'text-emerald-400' : diffAbs < 1000 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl overflow-hidden" style={{ borderTopColor: accentColor }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${accentBg}`}>
            <Wallet className={`w-3.5 h-3.5 ${accentText}`} />
          </div>
          <h3 className="text-white font-semibold text-sm">{title}</h3>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold ${accentBg} ${accentBorder} ${accentText}`}>
          {formatCurrency(saldoTotal)}
        </div>
      </div>

      {/* Saldo declarado */}
      <div className="px-5 py-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Saldo declarado</span>
          {saldoRow && !editingSaldo && (
            <button onClick={() => { setSaldoInput(String(saldoRow.valor)); setEditingSaldo(true) }} className="text-zinc-600 hover:text-white transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {editingSaldo || !saldoRow ? (
          <div className="flex items-center gap-2 mt-2">
            <input autoFocus type="number" value={saldoInput} onChange={e => setSaldoInput(e.target.value)} placeholder="0.00"
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white font-bold rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            <button onClick={handleSaveSaldo} disabled={saving} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"><Check className="w-4 h-4" /></button>
            {saldoRow && <button onClick={() => setEditingSaldo(false)} className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>}
          </div>
        ) : (
          <p className={`font-bold text-2xl ${accentText}`}>{formatCurrency(saldoTotal)}</p>
        )}
        {!saldoRow && !editingSaldo && (
          <button onClick={() => { setSaldoInput(''); setEditingSaldo(true) }} className="mt-2 flex items-center gap-1 text-zinc-500 hover:text-emerald-400 text-xs transition-colors">
            <Plus className="w-3.5 h-3.5" />Definir saldo
          </button>
        )}
      </div>

      {/* Items */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800/50">
            <th className="px-5 py-2.5 text-left text-zinc-500 text-xs font-medium uppercase tracking-wider">Onde está</th>
            <th className="px-5 py-2.5 text-right text-zinc-500 text-xs font-medium uppercase tracking-wider">Valor</th>
            <th className="px-5 py-2.5 text-right text-zinc-500 text-xs font-medium uppercase tracking-wider">%</th>
            <th className="px-4 py-2.5 w-16" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && !addingItem && (
            <tr><td colSpan={4} className="px-5 py-6 text-center text-zinc-600 text-xs">Nenhuma localização registrada</td></tr>
          )}
          {items.map(item => {
            const pct = saldoTotal > 0 ? (Number(item.valor) / saldoTotal) * 100 : 0
            const isEditing = editingItem?.id === item.id
            return (
              <tr key={item.id} className="border-b border-zinc-800/30 group hover:bg-zinc-800/30 transition-colors">
                <td className="px-5 py-3.5">
                  {isEditing
                    ? <input autoFocus value={editingItem.descricao} onChange={e => setEditingItem(s => s ? { ...s, descricao: e.target.value } : s)} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full" />
                    : <span className="text-zinc-300 text-sm">{item.descricao}</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {isEditing
                    ? <input type="number" value={editingItem.valor} onChange={e => setEditingItem(s => s ? { ...s, valor: e.target.value } : s)} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-28 text-right" />
                    : <span className="text-white font-medium">{formatCurrency(Number(item.valor))}</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-zinc-500 text-xs">{pct.toFixed(1)}%</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button onClick={handleEditItem} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditingItem({ id: item.id, descricao: item.descricao, valor: String(item.valor) })} className="text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {addingItem && (
            <tr className="border-b border-zinc-800/30 bg-zinc-800/20">
              <td className="px-5 py-3"><input autoFocus value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Ex: Conta Itaú" className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full" /></td>
              <td className="px-5 py-3 text-right"><input type="number" value={newValor} onChange={e => setNewValor(e.target.value)} placeholder="0.00" className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-28 text-right" /></td>
              <td />
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={handleAddItem} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setAddingItem(false); setNewDesc(''); setNewValor('') }} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!addingItem && (
        <div className="px-5 py-3 border-t border-zinc-800/50">
          <button onClick={() => { setAddingItem(true); setEditingItem(null) }} className="flex items-center gap-1.5 text-zinc-500 hover:text-emerald-400 text-xs transition-colors">
            <Plus className="w-3.5 h-3.5" />Adicionar localização
          </button>
        </div>
      )}

      {/* Conciliação interna */}
      {saldoRow && items.length > 0 && (
        <div className={`mx-5 mb-4 px-4 py-3 rounded-xl border ${diffAbs === 0 ? 'bg-emerald-500/5 border-emerald-500/20' : diffAbs < 1000 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Declarado</span>
            <ArrowRight className="w-3 h-3 text-zinc-600" />
            <span className="text-zinc-500">Discriminado</span>
            <ArrowRight className="w-3 h-3 text-zinc-600" />
            <span className="text-zinc-500">Diferença</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-white font-semibold text-sm">{formatCurrency(saldoTotal)}</span>
            <span className="text-zinc-500 text-sm">{formatCurrency(totalItems)}</span>
            <span className={`font-bold text-sm ${diffTextColor}`}>{diferenca >= 0 ? '+' : ''}{formatCurrency(diferenca)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Capital Fora do Caixa ────────────────────────────────────────────────────

const EMPTY_ITEM: Omit<ItemForaDoKaixa, 'id'> = {
  contrato: '', cliente: '', valor: 0, status: 'em_operacao',
  data_saida: '', mes_competencia: '', previsao_retorno: '', responsavel: '',
}

function CapitalForaDoCaixa() {
  const [items, setItems] = useState<ItemForaDoKaixa[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<typeof EMPTY_ITEM>({ ...EMPTY_ITEM })

  function handleAdd() {
    if (!form.contrato.trim()) return
    setItems(prev => [...prev, { ...form, id: String(Date.now()), valor: Number(form.valor) }])
    setForm({ ...EMPTY_ITEM })
    setAdding(false)
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleStatusChange(id: string, status: StatusCapital) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const totalFora = items.reduce((s, i) => s + Number(i.valor), 0)

  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl overflow-hidden" style={{ borderTopColor: '#F59E0B' }}>
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Capital Fora do Caixa</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Valores alocados, travados ou sem liquidez imediata</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalFora > 0 && (
            <span className="text-amber-400 font-bold text-sm">{formatCurrency(totalFora)}</span>
          )}
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar
          </button>
        </div>
      </div>

      {adding && (
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Contrato</label>
              <input value={form.contrato} onChange={e => setForm(f => ({ ...f, contrato: e.target.value }))} placeholder="Ref. contrato" className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Cliente</label>
              <input value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Nome" className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Valor (R$)</label>
              <input type="number" value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))} placeholder="0,00" className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusCapital }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500">
                {(Object.keys(STATUS_LABEL) as StatusCapital[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Data de saída</label>
              <input type="date" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Mês competência</label>
              <input type="month" value={form.mes_competencia} onChange={e => setForm(f => ({ ...f, mes_competencia: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Previsão retorno</label>
              <input type="date" value={form.previsao_retorno} onChange={e => setForm(f => ({ ...f, previsao_retorno: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-1">Responsável</label>
              <input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome" className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5" />Salvar
            </button>
            <button onClick={() => { setAdding(false); setForm({ ...EMPTY_ITEM }) }} className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3 py-2 rounded-lg transition-colors">
              <X className="w-3.5 h-3.5" />Cancelar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding ? (
        <div className="px-5 py-8 text-center">
          <Lock className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">Nenhum capital registrado fora do caixa</p>
          <p className="text-zinc-600 text-xs mt-1">Use esta seção para rastrear valores em operação, judicializados ou travados</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">Contrato</th>
                <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Cliente</th>
                <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Valor</th>
                <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Status</th>
                <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Saída</th>
                <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Retorno</th>
                <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Responsável</th>
                <th className="py-3 px-4 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="py-3.5 px-5 text-white font-medium text-sm">{item.contrato}</td>
                  <td className="py-3.5 px-4 text-zinc-400 text-sm">{item.cliente || '—'}</td>
                  <td className="py-3.5 px-4 text-right text-amber-400 font-semibold text-sm">{formatCurrency(item.valor)}</td>
                  <td className="py-3.5 px-4">
                    <select
                      value={item.status}
                      onChange={e => handleStatusChange(item.id, e.target.value as StatusCapital)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border cursor-pointer focus:outline-none transition-colors ${STATUS_STYLE[item.status]}`}
                      style={{ backgroundColor: 'transparent' }}
                    >
                      {(Object.keys(STATUS_LABEL) as StatusCapital[]).map(s => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500 text-xs">{item.data_saida ? new Date(item.data_saida + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-3.5 px-4 text-zinc-500 text-xs">{item.previsao_retorno ? new Date(item.previsao_retorno + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-3.5 px-4 text-zinc-400 text-sm">{item.responsavel || '—'}</td>
                  <td className="py-3.5 px-4">
                    <button onClick={() => handleDelete(item.id)} className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CaixaPage() {
  const [mes, setMes] = useState(getCurrentMes)
  const [rows, setRows] = useState<CaixaRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load(m: string) {
    setLoading(true)
    const r = await fetch(`/api/caixa?mes=${m}`)
    const data = await r.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load(mes) }, [mes])

  const renanRows = rows.filter(r => r.caixa_tipo === 'renan')
  const bpxRows = rows.filter(r => r.caixa_tipo === 'bpx' || !r.caixa_tipo)

  const saldoRenan = Number(renanRows.find(r => r.tipo === 'saldo')?.valor ?? 0)
  const saldoBPX = Number(bpxRows.find(r => r.tipo === 'saldo')?.valor ?? 0)
  const totalGeral = saldoRenan + saldoBPX

  const totalDiscriminado = [...renanRows, ...bpxRows]
    .filter(r => r.tipo === 'item')
    .reduce((s, i) => s + Number(i.valor), 0)
  const diferencaConsolidada = totalGeral - totalDiscriminado
  const diffAbs = Math.abs(diferencaConsolidada)

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Caixa" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── NAVEGAÇÃO DE MÊS ── */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMes(m => addMonth(m, -1))} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-base min-w-[160px] text-center">{formatMesLabel(mes)}</span>
          <button onClick={() => setMes(m => addMonth(m, 1))} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {loading && <span className="text-zinc-500 text-xs animate-pulse">Carregando...</span>}
        </div>

        {/* ── KPI CARDS — POSIÇÃO DE CAPITAL ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label="Capital Total"
            value={loading ? '—' : formatCurrency(totalGeral)}
            sub="soma Renan + BPX"
            icon={Wallet}
            color="#71717a"
            colorClass="text-zinc-400"
            bgClass="bg-zinc-700/30"
          />
          <KpiCard
            label="Caixa Disponível"
            value={loading ? '—' : formatCurrency(totalGeral)}
            sub="saldo declarado em conta"
            icon={TrendingUp}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label="Capital em Operação"
            value="—"
            sub="dinheiro alocado em contratos"
            icon={Briefcase}
            color="#3B82F6"
            colorClass="text-blue-400"
            bgClass="bg-blue-500/10"
          />
          <KpiCard
            label="Capital Travado"
            value="—"
            sub="judicializado ou sem liquidez"
            icon={Lock}
            color="#F59E0B"
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
          />
        </div>

        {/* ── ESTRUTURA DO CAPITAL ── */}
        {!loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-5">Posição de Capital — {formatMesLabel(mes)}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: 'Total', value: totalGeral, bg: 'bg-zinc-700/30', border: 'border-zinc-600/30', text: 'text-zinc-300' },
                { label: 'Renan', value: saldoRenan, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
                { label: 'BPX', value: saldoBPX, bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
              ].map((item, i, arr) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`${item.bg} border ${item.border} rounded-xl px-4 py-3 text-center min-w-[120px]`}>
                    <p className="text-zinc-500 text-xs mb-1">{item.label}</p>
                    <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.value)}</p>
                    {totalGeral > 0 && item.label !== 'Total' && (
                      <p className="text-zinc-600 text-xs mt-0.5">{((item.value / totalGeral) * 100).toFixed(1)}%</p>
                    )}
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CAIXAS INDIVIDUAIS ── */}
        {!loading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CaixaSection title="Caixa Renan" caixaTipo="renan" mes={mes} rows={renanRows} onReload={() => load(mes)} />
            <CaixaSection title="Caixa BPX" caixaTipo="bpx" mes={mes} rows={bpxRows} onReload={() => load(mes)} />
          </div>
        )}

        {/* ── CAPITAL FORA DO CAIXA ── */}
        <CapitalForaDoCaixa />

        {/* ── CONCILIAÇÃO CONSOLIDADA ── */}
        {!loading && (
          <div className={`bg-zinc-900 border rounded-xl px-6 py-5 ${diffAbs === 0 ? 'border-emerald-500/20' : diffAbs < 1000 ? 'border-yellow-500/20' : 'border-red-500/20'}`}>
            <div className="flex items-center gap-2 mb-4">
              {diffAbs > 0 && <AlertTriangle className={`w-4 h-4 shrink-0 ${diffAbs < 1000 ? 'text-yellow-400' : 'text-red-400'}`} />}
              <p className="text-white font-semibold text-sm">Conciliação Consolidada</p>
              {diffAbs === 0 && <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Balanceado ✓</span>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Total Declarado</p>
                <p className="text-white font-bold text-xl">{formatCurrency(totalGeral)}</p>
                <p className="text-zinc-600 text-xs mt-1">saldo em conta</p>
              </div>
              <div className="text-center">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Total Discriminado</p>
                <p className="text-white font-bold text-xl">{formatCurrency(totalDiscriminado)}</p>
                <p className="text-zinc-600 text-xs mt-1">soma das localizações</p>
              </div>
              <div className="text-center">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Diferença</p>
                <p className={`font-bold text-xl ${diffAbs === 0 ? 'text-emerald-400' : diffAbs < 1000 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {diferencaConsolidada >= 0 ? '+' : ''}{formatCurrency(diferencaConsolidada)}
                </p>
                <p className="text-zinc-600 text-xs mt-1">{diffAbs === 0 ? 'sem divergência' : 'valor não discriminado'}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
