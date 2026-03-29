'use client'

import { useEffect, useState, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { KPI_LABELS as L } from '@/lib/calculos'
import {
  Plus, Pencil, Trash2, X, Check,
  FileText, Briefcase, DollarSign, TrendingUp, Clock,
  Upload, AlertCircle, Loader2,
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

const SERVICOS = [
  'Empréstimo Consignado',
  'Compra de Dívida',
  'Remuneração CCA1',
  'Remuneração CCA2',
] as const

const EMPTY_FORM = { nome: '', servico: SERVICOS[0] as string, capital: '', taxa: '', status: 'aguardando' as Contrato['status'] }

type DocxPreview = {
  nome: string | null
  capital: number | null
  taxa: number | null
  total: number | null
  vencimento: string | null
  servico: string
  naoEncontrados: string[]
}

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
  const [filtroServico, setFiltroServico] = useState<string>('todos')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Upload .docx
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [preview, setPreview] = useState<DocxPreview | null>(null)

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

  async function handleDocxUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    setPreview(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/contratos/parse-docx', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { setUploadError(data.error); setUploading(false); return }
      setPreview(data.campos ? { ...data.campos, naoEncontrados: data.naoEncontrados ?? [] } : null)
    } catch (err) {
      setUploadError(String(err))
    }
    setUploading(false)
    e.target.value = ''
  }

  function handleConfirmarImport() {
    if (!preview) return
    setForm({
      nome: preview.nome ?? '',
      servico: preview.servico ?? '',
      capital: preview.capital != null ? String(preview.capital) : '',
      taxa: preview.taxa != null ? String(preview.taxa) : '',
      status: 'aguardando',
    })
    setPreview(null)
    setEditId(null)
    setError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const contratosFiltrados = filtroServico === 'todos'
    ? contratos
    : contratos.filter(c => c.servico === filtroServico)

  const totalCapital = contratos.reduce((s, c) => s + c.capital, 0)
  const totalTaxas = contratos.reduce((s, c) => s + c.taxa, 0)
  const totalGeral = totalCapital + totalTaxas
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
            label="Saldo Total"
            value={formatCurrency(totalGeral)}
            sub={`Capital ${formatCurrency(totalCapital)} + Serv. ${formatCurrency(totalTaxas)}`}
            icon={Briefcase}
            color="#3B82F6"
            colorClass="text-blue-400"
            bgClass="bg-blue-500/10"
          />
          <KpiCard
            label={L.receitaTotal}
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

        {/* ── UPLOAD DOCX ── */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={handleDocxUpload}
        />

        {/* Preview de importação */}
        {preview && (
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <FileText className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">Contrato lido com sucesso</h4>
                  <p className="text-zinc-500 text-xs">Confira os dados antes de salvar</p>
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Cliente', value: preview.nome, color: 'text-white' },
                { label: 'Serviço', value: preview.servico, color: 'text-zinc-300' },
                { label: 'Capital (Saldo Devedor)', value: preview.capital != null ? formatCurrency(preview.capital) : null, color: 'text-blue-400' },
                { label: 'Taxa (Serv. Financeiros)', value: preview.taxa != null ? formatCurrency(preview.taxa) : null, color: 'text-emerald-400' },
                { label: 'Total Devedor', value: preview.total != null ? formatCurrency(preview.total) : null, color: 'text-zinc-300' },
                { label: 'Vencimento', value: preview.vencimento ? new Date(preview.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null, color: 'text-zinc-300' },
              ].map(f => (
                <div key={f.label} className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
                  <p className="text-zinc-500 text-xs mb-0.5">{f.label}</p>
                  {f.value ? (
                    <p className={`text-sm font-semibold ${f.color}`}>{f.value}</p>
                  ) : (
                    <p className="text-zinc-600 text-xs italic">Não encontrado</p>
                  )}
                </div>
              ))}
            </div>

            {preview.naoEncontrados.length > 0 && (
              <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-300 text-xs font-medium">Campos não identificados automaticamente:</p>
                  <p className="text-yellow-400/70 text-xs mt-0.5">{preview.naoEncontrados.join(', ')} — você poderá preencher manualmente.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleConfirmarImport}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Confirmar e editar
              </button>
              <button
                onClick={() => setPreview(null)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{uploadError}</p>
            <button onClick={() => setUploadError('')} className="ml-auto text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
          </div>
        )}

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
                <select
                  value={form.servico}
                  onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {SERVICOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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

        {/* ── FILTROS ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider mr-1">Filtrar:</span>
          {(['todos', ...SERVICOS] as string[]).map(s => (
            <button
              key={s}
              onClick={() => setFiltroServico(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                filtroServico === s
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {s === 'todos' ? 'Todos' : s}
            </button>
          ))}
        </div>

        {/* ── TABELA ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">Lista de Contratos</h3>
              {!loading && (
                <p className="text-zinc-500 text-xs mt-0.5">{contratosFiltrados.length} registro{contratosFiltrados.length !== 1 ? 's' : ''}{filtroServico !== 'todos' ? ` · ${filtroServico}` : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Lendo...' : 'Importar .docx'}
              </button>
              <button
                onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError('') }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Contrato
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-zinc-500 text-sm animate-pulse">Carregando...</div>
          ) : contratosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">{filtroServico === 'todos' ? 'Nenhum contrato cadastrado' : `Nenhum contrato de "${filtroServico}"`}</p>
              {filtroServico === 'todos' && <p className="text-zinc-600 text-xs mt-1">Clique em "Novo Contrato" para começar</p>}
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
                  {contratosFiltrados.map(c => (
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
