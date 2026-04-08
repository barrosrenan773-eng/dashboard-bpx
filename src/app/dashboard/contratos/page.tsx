'use client'

import { useEffect, useState, useRef } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { KPI_LABELS as L } from '@/lib/calculos'
import {
  Plus, Pencil, Trash2, X, Check,
  FileText, Briefcase, DollarSign, TrendingUp, Clock, CheckCircle2,
  Upload, AlertCircle, Loader2, Paperclip, Download, ExternalLink,
} from 'lucide-react'

type Contrato = {
  id: number
  nome: string
  servico: string
  origem: string | null
  capital: number
  taxa: number
  status: 'aguardando' | 'finalizado'
  data_finalizacao: string | null
  arquivo_url: string | null
  arquivo_nome: string | null
  created_at: string
}

const STATUS_LABEL: Record<Contrato['status'], string> = {
  aguardando: 'Aguardando liberação de margem',
  finalizado: 'Finalizado',
}

const STATUS_STYLE: Record<Contrato['status'], string> = {
  aguardando: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  finalizado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

const SERVICOS = [
  'Compra de Dívida',
  'Consignado',
  'Remuneração Diferida',
] as const

const ORIGENS = ['BPX', 'CCA1', 'CCA2'] as const

const EMPTY_FORM = {
  nome: '',
  servico: SERVICOS[0] as string,
  origem: ORIGENS[0] as string,
  capital: '',
  taxa: '',
  status: 'aguardando' as Contrato['status'],
  data_finalizacao: '',
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

  // Arquivo anexo
  const anexoRef = useRef<HTMLInputElement>(null)
  const [anexoFile, setAnexoFile] = useState<File | null>(null)
  const [uploadingAnexo, setUploadingAnexo] = useState(false)

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
      origem: form.origem || null,
      capital: parseFloat(form.capital) || 0,
      taxa: parseFloat(form.taxa) || 0,
      status: form.status,
      data_finalizacao: form.data_finalizacao || null,
    }
    const res = editId
      ? await fetch('/api/contratos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...body }) })
      : await fetch('/api/contratos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false); return }

    // Se tiver arquivo selecionado, faz upload
    if (anexoFile && data.id) {
      setUploadingAnexo(true)
      const fd = new FormData()
      fd.append('file', anexoFile)
      fd.append('id', String(data.id))
      await fetch('/api/contratos/upload', { method: 'POST', body: fd })
      setUploadingAnexo(false)
    } else if (anexoFile && editId) {
      setUploadingAnexo(true)
      const fd = new FormData()
      fd.append('file', anexoFile)
      fd.append('id', String(editId))
      await fetch('/api/contratos/upload', { method: 'POST', body: fd })
      setUploadingAnexo(false)
    }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditId(null)
    setAnexoFile(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este contrato?')) return
    await fetch(`/api/contratos?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function handleRemoverAnexo(id: number) {
    await fetch(`/api/contratos/upload?id=${id}`, { method: 'DELETE' })
    load()
  }

  function handleEdit(c: Contrato) {
    setForm({
      nome: c.nome,
      servico: c.servico,
      origem: c.origem ?? ORIGENS[0],
      capital: String(c.capital),
      taxa: String(c.taxa),
      status: c.status,
      data_finalizacao: c.data_finalizacao ?? '',
    })
    setEditId(c.id)
    setAnexoFile(null)
    setShowForm(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancel() {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditId(null)
    setError('')
    setAnexoFile(null)
  }

  async function handleStatusChange(id: number, status: Contrato['status']) {
    await fetch('/api/contratos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
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

        {/* ── FORMULÁRIO MANUAL ── */}
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
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Nome do cliente *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Tipo de serviço *</label>
                <select
                  value={form.servico}
                  onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {SERVICOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Capital — Saldo Devedor (R$)</label>
                <input
                  type="number"
                  value={form.capital}
                  onChange={e => setForm(f => ({ ...f, capital: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Taxa — Serviços Financeiros (R$)</label>
                <input
                  type="number"
                  value={form.taxa}
                  onChange={e => setForm(f => ({ ...f, taxa: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Origem</label>
                <select
                  value={form.origem ?? ORIGENS[0]}
                  onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Data de finalização</label>
                <input
                  type="date"
                  value={form.data_finalizacao ?? ''}
                  onChange={e => setForm(f => ({ ...f, data_finalizacao: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              {editId && (
                <div className="md:col-span-2">
                  <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Contrato['status'] }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="aguardando">Aguardando liberação de margem</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
              )}

              {/* Anexo de arquivo */}
              <div className="md:col-span-2">
                <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Contrato em Anexo (PDF, DOCX — referência)</label>
                <input
                  ref={anexoRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => setAnexoFile(e.target.files?.[0] ?? null)}
                />
                {anexoFile ? (
                  <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5">
                    <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-zinc-300 text-sm flex-1 truncate">{anexoFile.name}</span>
                    <button onClick={() => setAnexoFile(null)} className="text-zinc-500 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => anexoRef.current?.click()}
                    className="w-full flex items-center gap-2 bg-zinc-800 border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 rounded-lg px-3 py-3 text-sm transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    Clique para anexar o contrato (PDF, DOCX…)
                  </button>
                )}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving || uploadingAnexo}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                {saving || uploadingAnexo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {uploadingAnexo ? 'Enviando arquivo...' : saving ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar contrato'}
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
            <button
              onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); setAnexoFile(null) }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Contrato
            </button>
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
                    <th className="text-center text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4">Anexo</th>
                    <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">Data</th>
                    <th className="text-right text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-5">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {contratosFiltrados.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-800/40 transition-colors group">
                      <td className="py-4 px-5">
                        <div>
                          <span className="text-white font-medium text-sm">{c.nome}</span>
                          {c.origem && <span className="ml-2 text-zinc-600 text-xs">{c.origem}</span>}
                        </div>
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
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLE[c.status]}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                          {c.status === 'aguardando' && (
                            <button
                              onClick={() => handleStatusChange(c.id, 'finalizado')}
                              title="Marcar como Finalizado"
                              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Finalizar
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {c.arquivo_url ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={c.arquivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={c.arquivo_nome ?? 'Ver contrato'}
                              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="hidden md:inline max-w-[100px] truncate">{c.arquivo_nome ?? 'Anexo'}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                            <button
                              onClick={() => handleRemoverAnexo(c.id)}
                              title="Remover anexo"
                              className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-700 text-xs">—</span>
                        )}
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
