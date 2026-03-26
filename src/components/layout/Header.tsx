'use client'

import { Bell, RefreshCw } from 'lucide-react'

interface HeaderProps {
  title: string
  lastSync?: string
}

export function Header({ title, lastSync }: HeaderProps) {
  return (
    <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-6 sticky top-0 z-40">
      <h2 className="text-white font-semibold text-lg">{title}</h2>

      <div className="flex items-center gap-3">
        {lastSync && (
          <span className="text-zinc-500 text-xs flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
            Atualizado {lastSync}
          </span>
        )}

        <button className="relative p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
        </button>

        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <span className="text-emerald-400 text-xs font-bold">D</span>
        </div>
      </div>
    </header>
  )
}
