'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BarChart3 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard/vendedores')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Painel esquerdo — decorativo */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-zinc-900 border-r border-zinc-800 p-12">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <span className="text-white font-bold text-lg tracking-tight">
            Dashboard<span className="text-emerald-400">.</span>
          </span>
        </div>

        <div>
          <blockquote className="text-zinc-300 text-xl font-light leading-relaxed mb-4">
            "Dados claros, decisões precisas."
          </blockquote>
          <p className="text-zinc-600 text-sm">Painel de Performance</p>
        </div>

        {/* Mini preview decorativo */}
        <div className="space-y-3">
          {[
            { label: 'Receita Total', value: 'R$ 487.320', color: 'text-emerald-400' },
            { label: 'Leads no Mês', value: '1.842', color: 'text-blue-400' },
            { label: 'Conversão', value: '14,9%', color: 'text-yellow-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
              <span className="text-zinc-500 text-sm">{item.label}</span>
              <span className={`font-semibold text-sm ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span className="text-white font-bold text-lg">
              Dashboard<span className="text-emerald-400">.</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-white font-bold text-2xl">Bem-vindo</h2>
            <p className="text-zinc-500 text-sm mt-1">Entre com suas credenciais para acessar o painel</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wider block mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Entrando...' : 'Acessar Painel'}
            </button>
          </form>

          <p className="text-center text-zinc-700 text-xs mt-8">
            © {new Date().getFullYear()} · Painel de Performance
          </p>
        </div>
      </div>
    </div>
  )
}
