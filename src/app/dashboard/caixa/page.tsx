'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Wallet,
} from 'lucide-react'

type CaixaRow = {
  id: number
  tipo: 'saldo' | 'item'
  caixa_tipo: 'renan' | 'bpx'
  descricao: string
  valor: number
  mes: string
  created_at: string
}

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

function diffColor(diff: number): string {
  const abs = Math.abs(diff)
  if (abs === 0) return 'text-emerald-400'
  if (abs < 1000) return 'text-yellow-400'
  return 'text-red-400'
}

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
      await fetch('/api/caixa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saldoRow.id, valor }),
      })
    } else {
      await fetch('/api/caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'saldo', caixa_tipo: caixaTipo, descricao: `Saldo ${title}`, valor, mes }),
      })
    }
    setSaving(false)
    setEditingSaldo(false)
    onReload()
  }

  async function handleAddItem() {
    if (saving || !newDesc.trim()) return
    setSaving(true)
    await fetch('/api/caixa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'item', caixa_tipo: caixaTipo, descricao: newDesc, valor: parseFloat(newValor) || 0, mes }),
    })
    setSaving(false)
    setAddingItem(false)
    setNewDesc('')
    setNewValor('')
    onReload()
  }

  async function handleEditItem() {
    if (!editingItem || saving) return
    setSaving(true)
    await fetch('/api/caixa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingItem.id, descricao: editingItem.descricao, valor: parseFloat(editingItem.valor) || 0 }),
    })
    setSaving(false)
    setEditingItem(null)
    onReload()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir?')) return
    await fetch(`/api/caixa?id=${id}`, { method: 'DELETE' })
    onReload()
  }

  const accentColor = caixaTipo === 'renan' ? 'text-blue-400' : 'text-emerald-400'
  const accentBg = caixaTipo === 'renan' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 border-b border-zinc-800 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Wallet className={`w-4 h-4 ${accentColor}`} />
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        <div className={`px-3 py-1 rounded-full border text-xs font-bold ${accentBg} ${accentColor}`}>
          {formatCurrency(saldoTotal)}
        </div>
      </div>

      {/* Saldo edit */}
      <div className="px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Saldo declarado</span>
          {saldoRow && !editingSaldo && (
            <button onClick={() => { setSaldoInput(String(saldoRow.valor)); setEditingSaldo(true) }} className="text-zinc-600 hover:text-white transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {editingSaldo || (!saldoRow) ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              type="number"
              value={saldoInput}
              onChange={e => setSaldoInput(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white font-bold rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            />
            <button onClick={handleSaveSaldo} disabled={saving} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
              <Check className="w-4 h-4" />
            </button>
            {saldoRow && (
              <button onClick={() => setEditingSaldo(false)} className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <p className={`font-bold text-2xl ${accentColor}`}>{formatCurrency(saldoTotal)}</p>
        )}
        {!saldoRow && !editingSaldo && (
          <button onClick={() => { setSaldoInput(''); setEditingSaldo(true) }} className="mt-2 flex items-center gap-1 text-zinc-500 hover:text-emerald-400 text-xs transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Definir saldo
          </button>
        )}
      </div>

      {/* Items */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800/50">
            <th className="px-6 py-2.5 text-left text-zinc-500 text-xs font-medium">Onde está</th>
            <th className="px-6 py-2.5 text-right text-zinc-500 text-xs font-medium">Valor</th>
            <th className="px-6 py-2.5 text-right text-zinc-500 text-xs font-medium">%</th>
            <th className="px-6 py-2.5 w-16" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && !addingItem && (
            <tr>
              <td colSpan={4} className="px-6 py-5 text-center text-zinc-600 text-xs">Nenhum item ainda</td>
            </tr>
          )}
          {items.map(item => {
            const pct = saldoTotal > 0 ? (Number(item.valor) / saldoTotal) * 100 : 0
            const isEditing = editingItem?.id === item.id
            return (
              <tr key={item.id} className="border-b border-zinc-800/30 group hover:bg-zinc-800/20 transition-colors">
                <td className="px-6 py-3">
                  {isEditing ? (
                    <input autoFocus value={editingItem.descricao} onChange={e => setEditingItem(s => s ? { ...s, descricao: e.target.value } : s)}
                      className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full" />
                  ) : (
                    <span className="text-zinc-300">{item.descricao}</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {isEditing ? (
                    <input type="number" value={editingItem.valor} onChange={e => setEditingItem(s => s ? { ...s, valor: e.target.value } : s)}
                      className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-28 text-right" />
                  ) : (
                    <span className="text-white font-medium">{formatCurrency(Number(item.valor))}</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <span className="text-zinc-500 text-xs">{pct.toFixed(1)}%</span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <button onClick={handleEditItem} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditingItem({ id: item.id, descricao: item.descricao, valor: String(item.valor) })}
                          className="text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {addingItem && (
            <tr className="border-b border-zinc-800/30 bg-zinc-800/20">
              <td className="px-6 py-3">
                <input autoFocus value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Ex: Conta Itaú"
                  className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full" />
              </td>
              <td className="px-6 py-3 text-right">
                <input type="number" value={newValor} onChange={e => setNewValor(e.target.value)} placeholder="0.00"
                  className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-28 text-right" />
              </td>
              <td />
              <td className="px-6 py-3">
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
        <div className="px-6 py-3 border-t border-zinc-800/50">
          <button onClick={() => { setAddingItem(true); setEditingItem(null) }}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-emerald-400 text-xs transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Adicionar localização
          </button>
        </div>
      )}

    </div>
  )
}

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

  const saldoRenan = renanRows.find(r => r.tipo === 'saldo')?.valor ?? 0
  const saldoBPX = bpxRows.find(r => r.tipo === 'saldo')?.valor ?? 0
  const totalGeral = Number(saldoRenan) + Number(saldoBPX)

  const itemsRenan = renanRows.filter(r => r.tipo === 'item')
  const itemsBPX = bpxRows.filter(r => r.tipo === 'item')
  const totalDiscriminado = [...itemsRenan, ...itemsBPX].reduce((s, i) => s + Number(i.valor), 0)
  const diferencaConsolidada = totalGeral - totalDiscriminado

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Caixa" lastSync="" />

      <div className="p-6 space-y-6">

        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMes(m => addMonth(m, -1))} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-base min-w-[140px] text-center">{formatMesLabel(mes)}</span>
          <button onClick={() => setMes(m => addMonth(m, 1))} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Caixa Total consolidado */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-white" />
            <span className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Caixa Total Consolidado</span>
          </div>
          {loading ? (
            <p className="text-zinc-500 text-2xl font-bold">Carregando...</p>
          ) : (
            <>
              <p className="text-white font-bold text-4xl mb-4">{formatCurrency(totalGeral)}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Caixa Renan</p>
                  <p className="text-blue-400 font-bold text-2xl">{formatCurrency(Number(saldoRenan))}</p>
                  <p className="text-zinc-600 text-xs mt-1">{totalGeral > 0 ? ((Number(saldoRenan) / totalGeral) * 100).toFixed(1) : '0'}% do total</p>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Caixa BPX</p>
                  <p className="text-emerald-400 font-bold text-2xl">{formatCurrency(Number(saldoBPX))}</p>
                  <p className="text-zinc-600 text-xs mt-1">{totalGeral > 0 ? ((Number(saldoBPX) / totalGeral) * 100).toFixed(1) : '0'}% do total</p>
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && (
          /* Duas caixas separadas */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CaixaSection
              title="Caixa Renan"
              caixaTipo="renan"
              mes={mes}
              rows={renanRows}
              onReload={() => load(mes)}
            />
            <CaixaSection
              title="Caixa BPX"
              caixaTipo="bpx"
              mes={mes}
              rows={bpxRows}
              onReload={() => load(mes)}
            />
          </div>
        )}

        {/* Reconciliação consolidada */}
        {!loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Reconciliação Consolidada</p>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-center flex-1">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Total Declarado</p>
                <p className="text-white font-bold text-lg">{formatCurrency(totalGeral)}</p>
              </div>
              <div className="w-px h-10 bg-zinc-700" />
              <div className="text-center flex-1">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Total Discriminado</p>
                <p className="text-white font-bold text-lg">{formatCurrency(totalDiscriminado)}</p>
              </div>
              <div className="w-px h-10 bg-zinc-700" />
              <div className="text-center flex-1">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Diferença</p>
                <p className={`font-bold text-lg ${diffColor(diferencaConsolidada)}`}>{formatCurrency(diferencaConsolidada)}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
