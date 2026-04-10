'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Users,
  UserCog,
  BarChart2,
  LogOut,
  DollarSign,
  FileText,
  Banknote,
  Search,
  TrendingUp,
} from 'lucide-react'

const ALL_NAV = [
  { href: '/dashboard/geral',        label: 'Visão Geral',    icon: LayoutDashboard, aba: 'geral' },
  { href: '/dashboard/consultores',  label: 'Consultores',    icon: Users,           aba: 'consultores' },
  { href: '/dashboard/financeiro',   label: 'Financeiro',     icon: DollarSign,      aba: 'financeiro' },
  { href: '/dashboard/contratos',    label: 'Contratos',      icon: FileText,        aba: 'contratos' },
  { href: '/dashboard/caixa',        label: 'Caixa',          icon: Banknote,        aba: 'caixa' },
  { href: '/dashboard/localizador',  label: 'Servidores',     icon: Search,          aba: 'localizador' },
  { href: '/dashboard/usuarios',     label: 'Usuários',       icon: UserCog,         aba: 'usuarios' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [abasPermitidas, setAbasPermitidas] = useState<string[] | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('abas_permitidas, role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'admin') {
        setAbasPermitidas(ALL_NAV.map(n => n.aba))
      } else {
        setAbasPermitidas(profile?.abas_permitidas ?? ALL_NAV.map(n => n.aba))
      }
    })
  }, [])

  const navItems = ALL_NAV.filter(item =>
    abasPermitidas === null || abasPermitidas.includes(item.aba)
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-zinc-950 border-r border-zinc-800/60 flex flex-col z-50">

      {/* ── Logo ── */}
      <div className="px-5 py-5 border-b border-zinc-800/60">
        <div className="flex items-baseline gap-0.5">
          <h1 className="text-white font-bold text-xl tracking-tight leading-none">BPX</h1>
          <span
            className="text-emerald-400 font-bold text-xl leading-none"
            style={{ textShadow: '0 0 8px rgba(52,211,153,0.5)' }}
          >.</span>
        </div>
        <p className="text-zinc-600 text-[11px] mt-1 tracking-wide font-medium uppercase">
          Performance Dashboard
        </p>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                isActive
                  ? 'bg-emerald-500/10 text-white font-semibold'
                  : 'text-zinc-400 font-normal hover:bg-zinc-800/50 hover:text-zinc-100'
              )}
            >
              {/* Borda lateral ativa */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-emerald-400"
                  style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)' }}
                />
              )}

              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0 transition-all duration-200',
                  isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Logout ── */}
      <div className="px-3 py-3 border-t border-zinc-800/60">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100 transition-all duration-200"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}
