'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'

type Contrato = {
  id: number
  nome: string
  servico: string
  capital: number
  taxa: number
  status: 'aguardando' | 'pendente' | 'finalizado'
  created_at: string
}

const STATUS_LABEL = {
  aguardando: 'Aguardando liberação de margem',
  pendente: 'Pendente',
  finalizado: 'Finalizado',
}

const STATUS_COLOR = {
  aguardando: 'bg-yellow-500/25 text-yellow-200 border-yellow-400/60 hover:bg-yellow-500/35',
  pendente: 'bg-blue-500/25 text-blue-200 border-blue-400/60 hover:bg-blue-500/35',
  finalizado: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60 hover:bg-emerald-500/35',
}

const EMPTY_FORM = { nome: '', servico: '', capital: '', taxa: '', status: 'aguardando' as const }

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/contratos')
    const data = await r.json()
    setContratos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    setError('')
    if (!form.nome.trim() || !form.servico.trim()) {
      setError('Nome e serviço são obrigatórios.')
      return
    }
    setSaving(true)
    const body = {
      nome: form.nome,
      servico: form.servico,
      capital: parseFloat(form.capital) || 0,
      taxa: parseFloat(form.taxa) || 0,
      status: form.status,
    }

    const res = editId
      ? await fetch('/api/contratos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...body }) })
      : await fetch('/api/contratos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false); return }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este contrato?')) return
    await fetch(`/api/contratos?id=${id}`, { method: 'DELETE' })
    load()
  }

  function handleEdit(c: Contrato) {
    setForm({ nome: c.nome, servico: c.servico, capital: String(c.capital), taxa: String(c.taxa), status: c.status })
    setEditId(c.id)
    setShowForm(true)
    setError('')
  }

  function handleCancel() {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditId(null)
    setError('')
  }

  async function handleStatusChange(id: number, status: Contrato['status']) {
    await fetch('/api/contratos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
  }

  const totalCapital = contratos.reduce((s, c) => s + c.capital, 0)
  const totalTaxas = contratos.reduce((s, c) => s + c.taxa, 0)
  const totalFinalizados = contratos.filter(c => c.status === 'finalizado').length

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Contratos" lastSync="" />

      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Total de Contratos</p>
            <p className="text-white font-bold text-2xl">{contratos.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Capital Total</p>
            <p className="text-white font-bold text-2xl">{formatCurrency(totalCapital)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Total de Taxas</p>
            <p className="text-emerald-400 font-bold text-2xl">{formatCurrency(totalTaxas)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Finalizados</p>
            <p className="text-emerald-400 font-bold text-2xl">{totalFinalizados}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">Em Andamento</p>
            <p className="text-yellow-400 font-bold text-2xl">{contratos.length - totalFinalizados}</p>
          </div>
        </div>

        {/* Header da tabela */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-base">Lista de Contratos</h3>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError('') }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Contrato
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-4">{editId ? 'Editar Contrato' : 'Novo Contrato'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Nome</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do cliente"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Serviço</label>
                <input
                  value={form.servico}
                  onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  placeholder="Tipo de serviço"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Capital (R$)</label>
                <input
                  type="number"
                  value={form.capital}
                  onChange={e => setForm(f => ({ ...f, capital: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Taxa Cobrada (R$)</label>
                <input
                  type="number"
                  value={form.taxa}
                  onChange={e => setForm(f => ({ ...f, taxa: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Andamento</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Contrato['status'] }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="aguardando">Aguardando liberação de margem</option>
                  <option value="pendente">Pendente</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Carregando...</div>
          ) : contratos.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Nenhum contrato cadastrado ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Nome', 'Serviço', 'Capital', 'Taxa', 'Andamento', 'Ações'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {contratos.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{c.nome}</td>
                      <td className="py-3 px-4 text-zinc-300">{c.servico}</td>
                      <td className="py-3 px-4 text-white font-semibold">{formatCurrency(c.capital)}</td>
                      <td className="py-3 px-4 text-zinc-300">{formatCurrency(c.taxa)}</td>
                      <td className="py-3 px-4">
                        <select
                          value={c.status}
                          onChange={e => handleStatusChange(c.id, e.target.value as Contrato['status'])}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer focus:outline-none transition-colors ${STATUS_COLOR[c.status]}`}
                        >
                          <option value="aguardando">Aguardando liberação de margem</option>
                          <option value="pendente">Pendente</option>
                          <option value="finalizado">Finalizado</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(c)} className="text-zinc-400 hover:text-white transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="text-zinc-400 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
