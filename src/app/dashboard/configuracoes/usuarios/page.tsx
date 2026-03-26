'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { UserPlus, Trash2, Shield, Eye } from 'lucide-react'

type Usuario = {
  id: string
  email: string
  name: string
  role: 'admin' | 'visualizador'
  created_at: string
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoRole, setNovoRole] = useState<'admin' | 'visualizador'>('visualizador')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const data = await res.json()
    setUsuarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMsg('')
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: novoEmail, name: novoNome, role: novoRole }),
    })
    const data = await res.json()
    if (data.error) {
      setMsg('Erro: ' + data.error)
    } else {
      setMsg('Usuário criado! Um link de acesso foi enviado para ' + novoEmail)
      setNovoEmail('')
      setNovoNome('')
      setNovoRole('visualizador')
      carregar()
    }
    setSalvando(false)
  }

  async function alterarRole(id: string, role: 'admin' | 'visualizador') {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  async function deletar(id: string, email: string) {
    if (!confirm(`Remover acesso de ${email}?`)) return
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUsuarios(prev => prev.filter(u => u.id !== id))
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Usuários e Acessos" />
      <div className="p-6 space-y-6 max-w-3xl">

        {/* Adicionar usuário */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Adicionar Usuário</h3>
          <form onSubmit={criarUsuario} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Nome</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Email</label>
                <input
                  type="email"
                  value={novoEmail}
                  onChange={e => setNovoEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-zinc-500 text-xs mb-1 block">Nível de acesso</label>
                <select
                  value={novoRole}
                  onChange={e => setNovoRole(e.target.value as any)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="visualizador">Visualizador — só Vendedores e Metas</option>
                  <option value="admin">Admin — acesso completo</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {salvando ? 'Criando...' : 'Criar'}
              </button>
            </div>
            {msg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${msg.startsWith('Erro') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {msg}
              </p>
            )}
          </form>
        </div>

        {/* Lista de usuários */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Usuários</h3>
          {loading ? (
            <p className="text-zinc-500 text-sm">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{u.name || u.email}</p>
                    <p className="text-zinc-500 text-xs">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={u.role}
                      onChange={e => alterarRole(u.id, e.target.value as any)}
                      className="bg-zinc-700 border border-zinc-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="visualizador">Visualizador</option>
                      <option value="admin">Admin</option>
                    </select>
                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-400'}`}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {u.role === 'admin' ? 'Admin' : 'Visualizador'}
                    </span>
                    <button
                      onClick={() => deletar(u.id, u.email)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {usuarios.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">Nenhum usuário cadastrado</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
