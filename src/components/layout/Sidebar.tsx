'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  ShoppingCart,
  BarChart2,
  Settings,
  LogOut,
  Target,
  Tv2,
} from 'lucide-react'

const ALL_NAV = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard, adminOnly: true },
  { href: '/dashboard/canais', label: 'Canais', icon: TrendingUp, adminOnly: true },
  { href: '/dashboard/vendedores', label: 'Vendedores', icon: Users, adminOnly: false },
  { href: '/dashboard/produtos', label: 'Produtos', icon: ShoppingCart, adminOnly: true },
  { href: '/dashboard/metas', label: 'Metas', icon: Target, adminOnly: false },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart2, adminOnly: true },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<'admin' | 'visualizador' | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
        setRole(data?.role || 'visualizador')
      })
    })
  }, [])

  const navItems = ALL_NAV.filter(item => role === 'admin' || !item.adminOnly)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-zinc-950 border-r border-zinc-800 flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-zinc-800">
        <h1 className="text-white font-bold text-lg tracking-tight">
          Damatta<span className="text-emerald-400">.</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">Performance Dashboard</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* TV + User */}
      <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
        <button
          onClick={() => window.open('/dashboard/tv', '_blank')}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <Tv2 className="w-4 h-4" />
          Modo TV
        </button>
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
