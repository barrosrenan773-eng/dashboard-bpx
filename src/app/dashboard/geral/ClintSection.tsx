'use client'

import { useEffect, useState } from 'react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { KPI_LABELS as L } from '@/lib/calculos'
import { DollarSign, TrendingUp, Target, Users } from 'lucide-react'

type Consultor = { nome: string; deals: number; receita: number }
type ClintData = { receita: number; totalDeals: number; consultores: Consultor[] }

export function ClintSection({ mes, mesLabel }: { mes: string; mesLabel: string }) {
  const [data, setData] = useState<ClintData | null>(null)

  useEffect(() => {
    const hoje = new Date()
    const currentMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const start = `${mes}-01`
    const end = mes === currentMes
      ? hoje.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      : new Date(Number(mes.split('-')[0]), Number(mes.split('-')[1]), 0).toLocaleDateString('sv-SE')
    fetch(`/api/clint?mes=${mes}&start=${start}&end=${end}&noLeads=1`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
  }, [mes])

  if (!data) return null

  const topConsultores = data.consultores ?? []
  const totalReceita = data.receita ?? 0

  return (
    <>
      {/* KPIs CRM */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Receita CRM</p>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /></div>
          </div>
          <p className="text-emerald-400 font-bold text-2xl">{formatCurrency(totalReceita)}</p>
          <p className="text-zinc-500 text-xs mt-1">deals ganhos no mês</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Deals Ganhos</p>
            <div className="p-1.5 bg-blue-500/10 rounded-lg"><TrendingUp className="w-3.5 h-3.5 text-blue-400" /></div>
          </div>
          <p className="text-white font-bold text-2xl">{data.totalDeals}</p>
          <p className="text-zinc-500 text-xs mt-1">fechamentos no mês</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{L.ticketMedio}</p>
            <div className="p-1.5 bg-yellow-500/10 rounded-lg"><Target className="w-3.5 h-3.5 text-yellow-400" /></div>
          </div>
          <p className="text-white font-bold text-2xl">
            {data.totalDeals > 0 ? formatCurrency(totalReceita / data.totalDeals) : '—'}
          </p>
          <p className="text-zinc-500 text-xs mt-1">por deal fechado</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Consultores</p>
            <div className="p-1.5 bg-purple-500/10 rounded-lg"><Users className="w-3.5 h-3.5 text-purple-400" /></div>
          </div>
          <p className="text-white font-bold text-2xl">{topConsultores.length}</p>
          <p className="text-zinc-500 text-xs mt-1">com fechamentos</p>
        </div>
      </div>

      {/* Top Consultores */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-zinc-400" />
          <h3 className="text-white font-semibold text-sm">Top Consultores — {mesLabel}</h3>
        </div>
        {topConsultores.length > 0 ? (
          <div className="space-y-3">
            {topConsultores.slice(0, 8).map((v, i) => {
              const pct = totalReceita > 0 ? (v.receita / totalReceita) * 100 : 0
              return (
                <div key={v.nome} className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs w-5 shrink-0 text-right">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <span className="text-white text-sm font-medium w-36 truncate shrink-0">{v.nome}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-white text-sm font-semibold w-28 text-right shrink-0">{formatCurrency(v.receita)}</span>
                  <span className="text-zinc-500 text-xs w-10 text-right shrink-0">{formatNumber(v.deals)}d</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">Sem dados do Clint para este mês</p>
        )}
      </div>
    </>
  )
}
