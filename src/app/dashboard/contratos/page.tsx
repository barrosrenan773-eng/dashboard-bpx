'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, X, Check,
  FileText, Briefcase, DollarSign, TrendingUp, Clock,
} from 'lucide-react'

type Contrato = {
  id: number
  nome: string
  servico: string
  capital: number
  taxa: number
  status: 'aguardando' | 'pendente' | 'finalizado'
  created_at: string
}

const STATUS_LABEL: Record<Contrato['status'], string> = {
  aguardando: 'Aguardando margem',
  pendente: 'Pendente',
  finalizado: 'Finalizado',
}

const STATUS_STYLE: Record<Contrato['status'], string> = {
  aguardando: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  pendente:   'text-blue-400 bg-blue-500/10 border-blue-500/30',
  finalizado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

const EMPTY_FORM = { nome: '', servico: '', capital: '', taxa: '', status: 'aguardando' as Contrato['status'] }

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
  const emAndamento = contratos.filter(c => c.status !== 'finalizado').length

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Contratos" lastSync="Atualizado agora" />

      <div className="p-6 space-y-6">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <KpiCard
            label="Total"
            value={String(contratos.length)}
            sub={`${contratos.length} contrato${contratos.length !== 1 ? 's' : ''} cadastrado${contratos.length !== 1 ? 's' : ''}`}
            icon={FileText}
            color="#71717a"
            colorClass="text-zinc-400"
            bgClass="bg-zinc-700/30"
          />
          <KpiCard
            label="Capital Total"
            value={formatCurrency(totalCapital)}
            sub="capital empregado"
            icon={Briefcase}
            color="#3B82F6"
            colorClass="text-blue-400"
            bgClass="bg-blue-500/10"
          />
          <KpiCard
            label="Receita Total"
            value={formatCurrency(totalTaxas)}
            sub="soma das taxas"
            icon={DollarSign}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label="Finalizados"
            value={String(totalFinalizados)}
            sub={`${totalFinalizados > 0 ? ((totalFinalizados / contratos.length) * 100).toFixed(0) : 0}% do total`}
            icon={TrendingUp}
            color="#10B981"
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
          />
          <KpiCard
            label="Em Andamento"
            value={String(emAndamento)}
            sub="aguardando ou pendente"
            icon={Clock}
            color="#F59E0B"
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
          />
        </div>

        {/* ── FORMULÁRIO ── */}
        {showForm && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-white font-semibold text-base">
                {editId ? 'Editar Contrato' : 'Novo Contrato'}
              </h4>
              <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Nome do cliente</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Tipo de serviço</label>
                <input
                  value={form.servico}
                  onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  placeholder="Ex: Portabilidade, Refinanciamento..."
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
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Taxa cobrada (R$)</label>
                <input
                  type="number"
                  value={form.taxa}
                  onChange={e => setForm(f => ({ ...f, taxa: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Status</label>
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
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar contrato'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── TABELA ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">Lista de Contratos</h3>
              {!loading && (
                <p className="text-zinc-500 text-xs mt-0.5">{contratos.length} registro{contratos.length !== 1 ? 's' : ''}</p>
              )}
            </div>
            <button
              onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError('') }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Contrato
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-zinc-500 text-sm animate-pulse">Carregando...</div>
          ) : contratos.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhum contrato cadastrado</p>
              <p className="text-zinc-600 text-xs mt-1">Clique em "Novo Contrato" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">Cliente</th>
                    <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Serviço</th>
                    <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Capital</th>
                    <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Taxa</th>
                    <th className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Status</th>
                    <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">Data</th>
                    <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {contratos.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors group">
                      <td className="py-4 px-5">
                        <span className="text-white font-medium text-sm">{c.nome}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-zinc-400 text-sm">{c.servico}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-blue-400 font-semibold text-sm">{formatCurrency(c.capital)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(c.taxa)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={c.status}
                          onChange={e => handleStatusChange(c.id, e.target.value as Contrato['status'])}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition-colors ${STATUS_STYLE[c.status]}`}
                          style={{ backgroundColor: 'transparent' }}
                        >
                          <option value="aguardando">Aguardando margem</option>
                          <option value="pendente">Pendente</option>
                          <option value="finalizado">Finalizado</option>
                        </select>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="text-zinc-500 text-xs">
                          {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleEdit(c)}
                            title="Editar"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            title="Excluir"
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
