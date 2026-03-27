'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, X, Check,
  Users, UserCheck, UserX, Shield,
  Eye, EyeOff, KeyRound,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Usuario = {
  id: string
  email: string
  name: string
  role: string
  ativo: boolean
  abas_permitidas: string[]
  escopo: string
  ultimo_acesso: string | null
  created_at: string
}

type FormState = {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: string
  ativo: boolean
  abas_permitidas: string[]
  escopo: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES: { key: string; label: string; color: string; bg: string; border: string }[] = [
  { key: 'admin',       label: 'Administrador', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  { key: 'diretor',     label: 'Diretor',       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  { key: 'gestor',      label: 'Gestor',        color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30' },
  { key: 'financeiro',  label: 'Financeiro',    color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30' },
  { key: 'consultor',   label: 'Consultor',     color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  { key: 'operacional', label: 'Operacional',   color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { key: 'visualizador',label: 'Visualizador',  color: 'text-zinc-400',   bg: 'bg-zinc-700/30',   border: 'border-zinc-600/30' },
]

const ABAS = [
  { key: 'geral',       label: 'Visão Geral' },
  { key: 'consultores', label: 'Consultores' },
  { key: 'financeiro',  label: 'Financeiro' },
  { key: 'contratos',   label: 'Contratos' },
  { key: 'caixa',       label: 'Caixa' },
  { key: 'relatorios',  label: 'Relatórios' },
  { key: 'usuarios',    label: 'Usuários' },
]

const EMPTY_FORM: FormState = {
  name: '', email: '', password: '', confirmPassword: '',
  role: 'visualizador', ativo: true,
  abas_permitidas: ['geral', 'consultores', 'financeiro', 'contratos', 'caixa', 'relatorios'],
  escopo: 'geral',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRoleStyle(role: string) {
  return ROLES.find(r => r.key === role) ?? ROLES[ROLES.length - 1]
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, colorClass, bgClass }: {
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

// ─── Formulário (modal) ───────────────────────────────────────────────────────

function UsuarioForm({
  initial, onSave, onClose, saving, error, isEdit,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onClose: () => void
  saving: boolean
  error: string
  isEdit: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [showPwd, setShowPwd] = useState(false)

  function toggleAba(key: string) {
    setForm(f => ({
      ...f,
      abas_permitidas: f.abas_permitidas.includes(key)
        ? f.abas_permitidas.filter(a => a !== key)
        : [...f.abas_permitidas, key],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nome + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Nome</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">E-mail</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com"
                disabled={isEdit}
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50" />
            </div>
          </div>

          {/* Senha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                {isEdit ? 'Nova senha (opcional)' : 'Senha'}
              </label>
              <div className="relative">
                <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 pr-9 transition-colors" />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Confirmar senha</label>
              <input value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>
          </div>

          {/* Role + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Perfil</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors">
                {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">Escopo de dados</label>
              <select value={form.escopo} onChange={e => setForm(f => ({ ...f, escopo: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors">
                <option value="geral">Ver todos os dados</option>
                <option value="proprio">Ver apenas meus dados</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
            <div>
              <p className="text-white text-sm font-medium">Usuário ativo</p>
              <p className="text-zinc-500 text-xs mt-0.5">Usuários inativos não conseguem fazer login</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.ativo ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ativo ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Abas permitidas */}
          <div>
            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-3">Abas permitidas</label>
            <div className="grid grid-cols-2 gap-2">
              {ABAS.map(aba => {
                const checked = form.abas_permitidas.includes(aba.key)
                return (
                  <button key={aba.key} type="button" onClick={() => toggleAba(aba.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                      checked
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'}`}>
                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {aba.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-1">
            <button onClick={() => onSave(form)} disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
              <Check className="w-4 h-4" />
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
            </button>
            <button onClick={onClose} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2.5 rounded-lg transition-colors">
              <X className="w-4 h-4" />Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/usuarios')
    const data = await r.json()
    setUsuarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(form: FormState) {
    setFormError('')

    if (!editingUser && (!form.email || !form.password)) {
      setFormError('E-mail e senha são obrigatórios.')
      return
    }
    if (form.password && form.password !== form.confirmPassword) {
      setFormError('As senhas não coincidem.')
      return
    }
    if (!editingUser && form.password && form.password.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setSaving(true)
    let res: Response

    if (editingUser) {
      const body: Record<string, unknown> = {
        id: editingUser.id,
        name: form.name, role: form.role,
        ativo: form.ativo, abas_permitidas: form.abas_permitidas, escopo: form.escopo,
      }
      if (form.password) body.password = form.password
      res = await fetch('/api/usuarios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.name, password: form.password, role: form.role, abas_permitidas: form.abas_permitidas, escopo: form.escopo }),
      })
    }

    const data = await res.json()
    setSaving(false)
    if (data.error) { setFormError(data.error); return }

    setShowForm(false)
    setEditingUser(null)
    load()
  }

  async function handleToggleAtivo(u: Usuario) {
    await fetch('/api/usuarios', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, ativo: !u.ativo }),
    })
    load()
  }

  async function handleDelete(u: Usuario) {
    if (!confirm(`Excluir o usuário ${u.name || u.email}? Esta ação é irreversível.`)) return
    await fetch('/api/usuarios', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) })
    load()
  }

  function openEdit(u: Usuario) {
    setEditingUser(u)
    setFormError('')
    setShowForm(true)
  }

  function openNew() {
    setEditingUser(null)
    setFormError('')
    setShowForm(true)
  }

  const totalAtivos   = usuarios.filter(u => u.ativo).length
  const totalInativos = usuarios.filter(u => !u.ativo).length
  const perfis = [...new Set(usuarios.map(u => u.role))].length

  const editingForm: FormState = editingUser ? {
    name: editingUser.name || '',
    email: editingUser.email,
    password: '', confirmPassword: '',
    role: editingUser.role || 'visualizador',
    ativo: editingUser.ativo,
    abas_permitidas: editingUser.abas_permitidas || [],
    escopo: editingUser.escopo || 'geral',
  } : EMPTY_FORM

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Usuários" lastSync="Atualizado agora" />

      {showForm && (
        <UsuarioForm
          initial={editingForm}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingUser(null) }}
          saving={saving}
          error={formError}
          isEdit={!!editingUser}
        />
      )}

      <div className="p-6 space-y-6">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Total de Usuários" value={String(usuarios.length)} sub="cadastrados no sistema" icon={Users} color="#71717a" colorClass="text-zinc-400" bgClass="bg-zinc-700/30" />
          <KpiCard label="Usuários Ativos" value={String(totalAtivos)} sub="com acesso liberado" icon={UserCheck} color="#10B981" colorClass="text-emerald-400" bgClass="bg-emerald-500/10" />
          <KpiCard label="Usuários Inativos" value={String(totalInativos)} sub="acesso bloqueado" icon={UserX} color="#EF4444" colorClass="text-red-400" bgClass="bg-red-500/10" />
          <KpiCard label="Perfis Cadastrados" value={String(perfis)} sub="tipos de acesso distintos" icon={Shield} color="#8B5CF6" colorClass="text-violet-400" bgClass="bg-violet-500/10" />
        </div>

        {/* ── TABELA ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">Gestão de Usuários</h3>
              {!loading && <p className="text-zinc-500 text-xs mt-0.5">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</p>}
            </div>
            <button onClick={openNew} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Novo Usuário
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-zinc-500 text-sm animate-pulse">Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhum usuário cadastrado</p>
              <p className="text-zinc-600 text-xs mt-1">Clique em "Novo Usuário" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Nome','E-mail','Perfil','Abas','Escopo','Status','Último acesso','Ações'].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {usuarios.map(u => {
                    const rs = getRoleStyle(u.role)
                    const abas = u.abas_permitidas ?? []
                    return (
                      <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                              <span className="text-emerald-400 text-xs font-bold">{(u.name || u.email).charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-white font-medium text-sm">{u.name || '—'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-zinc-400 text-sm">{u.email}</td>
                        <td className="py-4 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${rs.bg} ${rs.border} ${rs.color}`}>
                            {rs.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {abas.slice(0, 3).map(a => (
                              <span key={a} className="text-zinc-400 text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
                                {ABAS.find(x => x.key === a)?.label ?? a}
                              </span>
                            ))}
                            {abas.length > 3 && (
                              <span className="text-zinc-600 text-xs">+{abas.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-xs ${u.escopo === 'proprio' ? 'text-amber-400' : 'text-zinc-400'}`}>
                            {u.escopo === 'proprio' ? 'Próprios dados' : 'Todos os dados'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button onClick={() => handleToggleAtivo(u)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${u.ativo ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                            title={u.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${u.ativo ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                          </button>
                        </td>
                        <td className="py-4 px-4 text-zinc-500 text-xs whitespace-nowrap">{formatDate(u.ultimo_acesso)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(u)} title="Editar" className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setEditingUser(u); setFormError(''); setShowForm(true) }} title="Redefinir senha" className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(u)} title="Excluir" className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
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

        {/* ── INFO: como funciona ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            Como funciona o controle de acesso
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Menu dinâmico', desc: 'O menu lateral exibe apenas as abas que o usuário tem permissão para acessar.' },
              { title: 'Escopo de dados', desc: '"Próprios dados" filtra apenas registros relacionados ao usuário logado. "Todos os dados" exibe tudo.' },
              { title: 'Perfis', desc: 'Admin e Diretor têm acesso total por padrão. Outros perfis seguem as permissões configuradas individualmente.' },
            ].map(item => (
              <div key={item.title} className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-white text-xs font-semibold mb-1">{item.title}</p>
                <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
