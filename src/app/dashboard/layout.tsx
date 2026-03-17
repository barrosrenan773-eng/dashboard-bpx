'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'
import { Minimize2 } from 'lucide-react'

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isTV = searchParams.get('tv') === '1'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
    })
  }, [router])

  if (isTV) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tv')
    const exitUrl = `${pathname}?${params.toString()}`
    return (
      <div className="min-h-screen bg-zinc-950 relative">
        <button
          onClick={() => router.push(exitUrl)}
          className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors text-xs font-medium backdrop-blur"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Sair do modo TV
        </button>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
