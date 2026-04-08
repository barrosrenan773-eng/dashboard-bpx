'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Pencil, Trash2, Plus, Check, X,
  Wallet, Briefcase, Lock, TrendingDown, ArrowRight,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type CaixaRow = {
  id: number; tipo: 'saldo' | 'item'; caixa_tipo: 'renan' | 'bpx'
  descricao: string; valor: number; mes: string
}

type Contrato = {
  id: number; nome: string; servico: string; origem: string | null
  capital: number; taxa: number
  status: 'aguardando' | 'pendente' | 'finalizado'
  data_finalizacao: string | null; created_at: string
}

type Despesa = {
  id: number; descricao: string; categoria: string; valor: number
  mes: string; empresa: string; created_at: string
}

type StatusFora = 'em_operacao' | 'aguardando_liquidacao' | 'judicializado' | 'em_recuperacao'

type CapitalFora = {
  id: number; contrato: string; cliente: string; valor: number
  status: StatusFora; data_saida: string | null; mes_competencia: string | null
  previsao_retorno: string | null; responsavel: string; observacoes: string
  created_at: string
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

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Status labels / styles ───────────────────────────────────────────────────

const STATUS_FORA_LABEL: Record<StatusFora, string> = {
  em_operacao: 'Em operação',
  aguardando_liquidacao: 'Aguardando liquidação',
  judicializado: 'Judicializado',
  em_recuperacao: 'Em recuperação',
}

const STATUS_FORA_STYLE: Record<StatusFora, string> = {
  em_operacao: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  aguardando_liquidacao: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  judicializado: 'text-red-400 bg-red-500/10 border-red-500/30',
  em_recuperacao: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
}

const CONTRATO_STATUS_STYLE: Record<string, string> = {
  aguardando: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  pendente: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  finalizado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, colorClass, bgClass }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; colorClass: string; bgClass: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgClass}`}><Icon className={`w-3.5 h-3.5 ${colorClass}`} /></div>
      </div>
      <p className="text-white font-bold text-2xl leading-tight">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1 truncate">{sub}</p>}
    </div>
  )
}

// ─── SectionBlock ─────────────────────────────────────────────────────────────

function SectionBlock({ title, subtitle, badge, expanded, onToggle, children }: {
  title: string; subtitle?: string; badge?: string
  expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors text-left">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm">{title}</h3>
            {badge && <span className="text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">{badge}</span>}
          </div>
          {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />}
      </button>
      {expanded && <div className="border-t border-zinc-800">{children}</div>}
    </div>
  )
}

// ─── CaixaSection ─────────────────────────────────────────────────────────────

function CaixaSection({ title, caixaTipo, mes, rows, onReload }: {
  title: string; caixaTipo: 'renan' | 'bpx'; mes: string; rows: CaixaRow[]; onReload: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [editingSaldo, setEditingSaldo] = useState(false)
  const [saldoInput, setSaldoInput] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newValor, setNewValor] = useState('')
  const [editingItem, setEditingItem] = useState<{ id: number; descricao: string; valor: string } | null>(null)

  const saldoRow = rows.find(r => r.tipo === 'saldo')
  const items = rows.filter(r => r.tipo === 'item')
  const saldoTotal = Number(saldoRow?.valor ?? 0)
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
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${accentBg}`}><Wallet className={`w-3.5 h-3.5 ${accentText}`} /></div>
          <h3 className="text-white font-semibold text-sm">{title}</h3>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold ${accentBg} ${accentBorder} ${accentText}`}>{formatCurrency(saldoTotal)}</div>
      </div>

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
            <tr><td colSpan={4} className="px-5 py-5 text-center text-zinc-600 text-xs">Nenhuma localização registrada</td></tr>
          )}
          {items.map(item => {
            const pct = saldoTotal > 0 ? (Number(item.valor) / saldoTotal) * 100 : 0
            const isEditing = editingItem?.id === item.id
            return (
              <tr key={item.id} className="border-b border-zinc-800/30 group hover:bg-zinc-800/30 transition-colors">
                <td className="px-5 py-3">
                  {isEditing
                    ? <input autoFocus value={editingItem.descricao} onChange={e => setEditingItem(s => s ? { ...s, descricao: e.target.value } : s)} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full" />
                    : <span className="text-zinc-300 text-sm">{item.descricao}</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  {isEditing
                    ? <input type="number" value={editingItem.valor} onChange={e => setEditingItem(s => s ? { ...s, valor: e.target.value } : s)} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-28 text-right" />
                    : <span className="text-white font-medium">{formatCurrency(Number(item.valor))}</span>}
                </td>
                <td className="px-5 py-3 text-right"><span className="text-zinc-500 text-xs">{pct.toFixed(1)}%</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button onClick={handleEditItem} disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditingItem({ id: item.id, descricao: item.descricao, valor: String(item.valor) })} className="text-zinc-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <td /><td className="px-4 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={handleAddItem} disabled={saving} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setAddingItem(false); setNewDesc(''); setNewValor('') }} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
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

// ─── CapitalForaSection ───────────────────────────────────────────────────────

const EMPTY_FORA = {
  contrato: '', cliente: '', valor: '', status: 'em_operacao' as StatusFora,
  data_saida: '', mes_competencia: '', previsao_retorno: '', responsavel: '', observacoes: '',
}

function CapitalForaSection({ items, onReload }: { items: CapitalFora[]; onReload: () => void }) {
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORA)

  function openAdd() { setForm(EMPTY_FORA); setAdding(true); setEditingId(null) }
  function openEdit(item: CapitalFora) {
    setForm({
      contrato: item.contrato, cliente: item.cliente || '', valor: String(item.valor),
      status: item.status, data_saida: item.data_saida || '',
      mes_competencia: item.mes_competencia || '', previsao_retorno: item.previsao_retorno || '',
      responsavel: item.responsavel || '', observacoes: item.observacoes || '',
    })
    setEditingId(item.id); setAdding(false)
  }

  async function handleSave() {
    if (saving || !form.contrato.trim()) return
    setSaving(true)
    const body = { ...form, valor: parseFloat(form.valor) || 0, data_saida: form.data_saida || null, mes_competencia: form.mes_competencia || null, previsao_retorno: form.previsao_retorno || null }
    if (adding) {
      await fetch('/api/capital-fora-caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else if (editingId) {
      await fetch('/api/capital-fora-caixa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...body }) })
    }
    setSaving(false); setAdding(false); setEditingId(null); onReload()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir?')) return
    await fetch(`/api/capital-fora-caixa?id=${id}`, { method: 'DELETE' }); onReload()
  }

  const showForm = adding || editingId !== null

  return (
    <div>
      {items.length === 0 && !showForm ? (
        <div className="p-8 text-center">
          <p className="text-zinc-600 text-sm">Nenhum capital fora do caixa registrado</p>
          <button onClick={openAdd} className="mt-3 flex items-center gap-1.5 text-zinc-500 hover:text-orange-400 text-xs transition-colors mx-auto">
            <Plus className="w-3.5 h-3.5" />Adicionar
          </button>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {items.map(item => {
            const isEditing = editingId === item.id
            return (
              <div key={item.id}>
                {isEditing ? (
                  <div className="p-5 bg-zinc-800/20 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Contrato *</label>
                        <input value={form.contrato} onChange={e => setForm(s => ({ ...s, contrato: e.target.value }))} placeholder="Nome do contrato" className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Cliente</label>
                        <input value={form.cliente} onChange={e => setForm(s => ({ ...s, cliente: e.target.value }))} placeholder="Nome do cliente" className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Valor (R$)</label>
                        <input type="number" value={form.valor} onChange={e => setForm(s => ({ ...s, valor: e.target.value }))} placeholder="0.00" className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Status</label>
                        <select value={form.status} onChange={e => setForm(s => ({ ...s, status: e.target.value as StatusFora }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                          {Object.entries(STATUS_FORA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Data de saída</label>
                        <input type="date" value={form.data_saida} onChange={e => setForm(s => ({ ...s, data_saida: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Previsão de retorno</label>
                        <input type="date" value={form.previsao_retorno} onChange={e => setForm(s => ({ ...s, previsao_retorno: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Responsável</label>
                        <input value={form.responsavel} onChange={e => setForm(s => ({ ...s, responsavel: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                      </div>
                      <div>
                        <label className="text-zinc-500 text-xs mb-1 block">Observações</label>
                        <input value={form.observacoes} onChange={e => setForm(s => ({ ...s, observacoes: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs transition-colors">
                        <Check className="w-3.5 h-3.5" />Salvar
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-5 py-4 group hover:bg-zinc-800/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">{item.contrato}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_FORA_STYLE[item.status]}`}>{STATUS_FORA_LABEL[item.status]}</span>
                      </div>
                      <p className="text-zinc-500 text-xs mt-0.5">{item.cliente || '—'} · Saída: {fmtDate(item.data_saida)}{item.previsao_retorno ? ` · Retorno prev.: ${fmtDate(item.previsao_retorno)}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-red-400 font-semibold text-sm">{fmt(item.valor)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(item)} className="text-zinc-500 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {showForm && adding && (
            <div className="p-5 bg-zinc-800/20 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Contrato *</label>
                  <input value={form.contrato} onChange={e => setForm(s => ({ ...s, contrato: e.target.value }))} placeholder="Nome do contrato" className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Cliente</label>
                  <input value={form.cliente} onChange={e => setForm(s => ({ ...s, cliente: e.target.value }))} placeholder="Nome do cliente" className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Valor (R$)</label>
                  <input type="number" value={form.valor} onChange={e => setForm(s => ({ ...s, valor: e.target.value }))} placeholder="0.00" className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(s => ({ ...s, status: e.target.value as StatusFora }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                    {Object.entries(STATUS_FORA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Data de saída</label>
                  <input type="date" value={form.data_saida} onChange={e => setForm(s => ({ ...s, data_saida: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Previsão de retorno</label>
                  <input type="date" value={form.previsao_retorno} onChange={e => setForm(s => ({ ...s, previsao_retorno: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Responsável</label>
                  <input value={form.responsavel} onChange={e => setForm(s => ({ ...s, responsavel: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs mb-1 block">Observações</label>
                  <input value={form.observacoes} onChange={e => setForm(s => ({ ...s, observacoes: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs transition-colors">
                  <Check className="w-3.5 h-3.5" />Salvar
                </button>
                <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          {!showForm && (
            <div className="px-5 py-3">
              <button onClick={openAdd} className="flex items-center gap-1.5 text-zinc-500 hover:text-orange-400 text-xs transition-colors">
                <Plus className="w-3.5 h-3.5" />Adicionar registro
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CaixaPage() {
  const [mes, setMes] = useState(getCurrentMes)

  // Data sources
  const [caixaRows, setCaixaRows] = useState<CaixaRow[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [capitalFora, setCapitalFora] = useState<CapitalFora[]>([])
  const [loading, setLoading] = useState(true)

  // Section expand state
  const [expRenan, setExpRenan] = useState(false)
  const [expBpx, setExpBpx] = useState(false)
  const [expOperacao, setExpOperacao] = useState(true)
  const [expDespesas, setExpDespesas] = useState(true)
  const [expFora, setExpFora] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [cRes, ctRes, dRes, cfRes] = await Promise.all([
      fetch(`/api/caixa?mes=${mes}`),
      fetch('/api/contratos'),
      fetch(`/api/despesas?mes=${mes}`),
      fetch('/api/capital-fora-caixa'),
    ])
    setCaixaRows(cRes.ok ? await cRes.json() : [])
    setContratos(ctRes.ok ? await ctRes.json() : [])
    setDespesas(dRes.ok ? await dRes.json() : [])
    setCapitalFora(cfRes.ok ? await cfRes.json() : [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [mes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed values ──────────────────────────────────────────────────────────

  const renanRows = caixaRows.filter(r => r.caixa_tipo === 'renan')
  const bpxRows   = caixaRows.filter(r => r.caixa_tipo === 'bpx')

  const caixaRenan = renanRows.find(r => r.tipo === 'saldo')?.valor ?? 0
  const caixaBpx   = bpxRows.find(r => r.tipo === 'saldo')?.valor ?? 0
  const caixaDisponivel = caixaRenan + caixaBpx

  // Capital em operação = contratos não finalizados
  const contratosEmOperacao = contratos.filter(c => c.status !== 'finalizado')
  const totalCapitalEmOperacao = contratosEmOperacao.reduce((s, c) => s + (c.capital ?? 0), 0)

  // Capital fora do caixa (judicializado / em operação externa)
  const totalCapitalFora = capitalFora.reduce((s, c) => s + (c.valor ?? 0), 0)

  // Despesas do período: mês atual, created_at até hoje
  const hoje = todayISO()
  const despesasPeriodo = despesas.filter(d => {
    const dt = d.created_at?.slice(0, 10) ?? ''
    return dt >= mes + '-01' && dt <= hoje
  })
  const totalDespesasPeriodo = despesasPeriodo.reduce((s, d) => s + (d.valor ?? 0), 0)

  // Caixa Total (conciliação)
  const caixaTotal = caixaDisponivel + totalCapitalEmOperacao + totalCapitalFora

  // Proportional bar widths
  const pctDisponivel = caixaTotal > 0 ? (caixaDisponivel / caixaTotal) * 100 : 0
  const pctOperacao   = caixaTotal > 0 ? (totalCapitalEmOperacao / caixaTotal) * 100 : 0
  const pctFora       = caixaTotal > 0 ? (totalCapitalFora / caixaTotal) * 100 : 0

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Caixa" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── Navegador de mês ── */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMes(m => addMonth(m, -1))}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-base min-w-[160px] text-center">{formatMesLabel(mes)}</span>
          <button onClick={() => setMes(m => addMonth(m, 1))}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {loading && <span className="text-zinc-600 text-xs animate-pulse ml-2">Carregando...</span>}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="col-span-2 xl:col-span-1">
            <KpiCard
              label="Caixa Total"
              value={fmt(caixaTotal)}
              sub="disponível + operação + judicializado"
              icon={Wallet}
              color="#f97316"
              colorClass="text-orange-400"
              bgClass="bg-orange-500/10"
            />
          </div>
          <KpiCard
            label="Caixa Disponível"
            value={fmt(caixaDisponivel)}
            sub={`Renan ${fmt(caixaRenan)} · BPX ${fmt(caixaBpx)}`}
            icon={Wallet}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label="Capital em Operação"
            value={fmt(totalCapitalEmOperacao)}
            sub={`${contratosEmOperacao.length} contrato${contratosEmOperacao.length !== 1 ? 's' : ''} ativos`}
            icon={Briefcase}
            color="#3B82F6"
            colorClass="text-blue-400"
            bgClass="bg-blue-500/10"
          />
          <KpiCard
            label="Capital Fora do Caixa"
            value={fmt(totalCapitalFora)}
            sub={`${capitalFora.length} registro${capitalFora.length !== 1 ? 's' : ''} · judicializado`}
            icon={Lock}
            color="#EF4444"
            colorClass="text-red-400"
            bgClass="bg-red-500/10"
          />
          <KpiCard
            label="Despesas do Período"
            value={fmt(totalDespesasPeriodo)}
            sub={`${despesasPeriodo.length} lançamento${despesasPeriodo.length !== 1 ? 's' : ''} até hoje`}
            icon={TrendingDown}
            color="#F59E0B"
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
          />
        </div>

        {/* ── Conciliação Visual ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Onde está o dinheiro?</h3>
            <span className="text-orange-400 font-bold text-sm">{fmt(caixaTotal)}</span>
          </div>

          {/* Barra proporcional */}
          <div className="flex h-4 rounded-full overflow-hidden gap-px">
            {pctDisponivel > 0 && (
              <div style={{ width: `${pctDisponivel}%` }} className="bg-emerald-500" title={`Disponível: ${fmt(caixaDisponivel)}`} />
            )}
            {pctOperacao > 0 && (
              <div style={{ width: `${pctOperacao}%` }} className="bg-blue-500" title={`Em operação: ${fmt(totalCapitalEmOperacao)}`} />
            )}
            {pctFora > 0 && (
              <div style={{ width: `${pctFora}%` }} className="bg-red-500" title={`Fora do caixa: ${fmt(totalCapitalFora)}`} />
            )}
            {caixaTotal === 0 && <div className="w-full bg-zinc-800 rounded-full" />}
          </div>

          {/* Legenda */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Caixa Disponível', value: caixaDisponivel, pct: pctDisponivel, color: 'bg-emerald-500', text: 'text-emerald-400', sub: 'conta bancária' },
              { label: 'Capital em Operação', value: totalCapitalEmOperacao, pct: pctOperacao, color: 'bg-blue-500', text: 'text-blue-400', sub: 'contratos ativos' },
              { label: 'Fora do Caixa', value: totalCapitalFora, pct: pctFora, color: 'bg-red-500', text: 'text-red-400', sub: 'judicializado' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3">
                <div className={`w-3 h-3 rounded-sm mt-0.5 flex-shrink-0 ${item.color}`} />
                <div>
                  <p className="text-zinc-400 text-xs">{item.label}</p>
                  <p className={`font-semibold text-sm ${item.text}`}>{fmt(item.value)}</p>
                  <p className="text-zinc-600 text-xs">{pctDisponivel + pctOperacao + pctFora > 0 ? `${item.pct.toFixed(0)}% · ` : ''}{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Equação de fechamento */}
          <div className="border-t border-zinc-800 pt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {[
                { label: 'Caixa Disponível', value: fmt(caixaDisponivel), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                { label: 'Capital em Operação', value: fmt(totalCapitalEmOperacao), color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                { label: 'Fora do Caixa', value: fmt(totalCapitalFora), color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`border rounded-xl px-3 py-2 ${item.bg}`}>
                    <p className="text-zinc-500 text-xs">{item.label}</p>
                    <p className={`font-bold ${item.color}`}>{item.value}</p>
                  </div>
                  {i < 2 && <span className="text-zinc-600 font-bold text-base">+</span>}
                </div>
              ))}
              <span className="text-zinc-600 font-bold text-base">=</span>
              <div className="border border-orange-500/30 bg-orange-500/10 rounded-xl px-3 py-2">
                <p className="text-zinc-500 text-xs">Caixa Total</p>
                <p className="font-bold text-orange-400">{fmt(caixaTotal)}</p>
              </div>
            </div>
          </div>

          {/* Nota de despesas */}
          {totalDespesasPeriodo > 0 && (
            <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <TrendingDown className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">
                <span className="font-semibold">{fmt(totalDespesasPeriodo)}</span> em despesas lançadas neste período explicam eventuais reduções no caixa disponível.
              </p>
            </div>
          )}
        </div>

        {/* ── Detalhamentos (collapsible) ── */}

        <SectionBlock
          title="Caixa Renan"
          subtitle="Saldo manual declarado"
          badge={fmt(caixaRenan)}
          expanded={expRenan}
          onToggle={() => setExpRenan(v => !v)}
        >
          <div className="p-4">
            <CaixaSection title="Caixa Renan" caixaTipo="renan" mes={mes} rows={renanRows} onReload={loadAll} />
          </div>
        </SectionBlock>

        <SectionBlock
          title="Caixa BPX"
          subtitle="Saldo manual declarado"
          badge={fmt(caixaBpx)}
          expanded={expBpx}
          onToggle={() => setExpBpx(v => !v)}
        >
          <div className="p-4">
            <CaixaSection title="Caixa BPX" caixaTipo="bpx" mes={mes} rows={bpxRows} onReload={loadAll} />
          </div>
        </SectionBlock>

        <SectionBlock
          title="Capital em Operação"
          subtitle="Contratos ativos — dinheiro que saiu mas ainda não retornou"
          badge={`${contratosEmOperacao.length} contrato${contratosEmOperacao.length !== 1 ? 's' : ''} · ${fmt(totalCapitalEmOperacao)}`}
          expanded={expOperacao}
          onToggle={() => setExpOperacao(v => !v)}
        >
          {contratosEmOperacao.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">Nenhum contrato ativo no momento</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Cliente', 'Serviço', 'Capital', 'Taxa', 'Status', 'Criado em'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {contratosEmOperacao.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-5 text-white font-medium text-sm truncate max-w-[140px]">{c.nome}</td>
                      <td className="py-3.5 px-5 text-zinc-400 text-sm">{c.servico || '—'}</td>
                      <td className="py-3.5 px-5 text-blue-400 font-semibold text-sm">{fmt(c.capital)}</td>
                      <td className="py-3.5 px-5 text-emerald-400 font-semibold text-sm">{fmt(c.taxa)}</td>
                      <td className="py-3.5 px-5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CONTRATO_STATUS_STYLE[c.status] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-zinc-500 text-xs">
                        {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={2} className="px-5 py-3 text-zinc-500 text-xs font-medium">Total</td>
                    <td className="px-5 py-3 text-blue-400 font-bold text-sm">{fmt(totalCapitalEmOperacao)}</td>
                    <td className="px-5 py-3 text-emerald-400 font-bold text-sm">{fmt(contratosEmOperacao.reduce((s, c) => s + (c.taxa ?? 0), 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionBlock>

        <SectionBlock
          title="Despesas do Período"
          subtitle={`Lançamentos de ${mes}-01 até hoje (${hoje})`}
          badge={`${despesasPeriodo.length} · ${fmt(totalDespesasPeriodo)}`}
          expanded={expDespesas}
          onToggle={() => setExpDespesas(v => !v)}
        >
          {despesasPeriodo.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">Nenhuma despesa no período</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Categoria', 'Descrição', 'Valor', 'Data'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {despesasPeriodo.map(d => (
                    <tr key={d.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-5 text-zinc-300 text-sm capitalize">{d.categoria || '—'}</td>
                      <td className="py-3.5 px-5 text-zinc-400 text-sm truncate max-w-[220px]">{d.descricao}</td>
                      <td className="py-3.5 px-5 text-red-400 font-semibold text-sm">{fmt(d.valor)}</td>
                      <td className="py-3.5 px-5 text-zinc-500 text-xs">{d.created_at?.slice(0, 10) || d.mes}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={2} className="px-5 py-3 text-zinc-500 text-xs font-medium">Total</td>
                    <td className="px-5 py-3 text-red-400 font-bold text-sm">{fmt(totalDespesasPeriodo)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionBlock>

        <SectionBlock
          title="Capital Fora do Caixa"
          subtitle="Valores judicializados, em recuperação ou em operação externa"
          badge={`${capitalFora.length} registro${capitalFora.length !== 1 ? 's' : ''} · ${fmt(totalCapitalFora)}`}
          expanded={expFora}
          onToggle={() => setExpFora(v => !v)}
        >
          <CapitalForaSection items={capitalFora} onReload={loadAll} />
        </SectionBlock>

      </div>
    </div>
  )
}
