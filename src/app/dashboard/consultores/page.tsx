'use client'

import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { KPI_LABELS } from '@/lib/calculos'

const L = KPI_LABELS

import {
  RefreshCw, Tv, X,
  Pencil, Check, TrendingUp, Users,
  Target, BarChart2, DollarSign, Clock, CalendarCheck,
} from 'lucide-react'

type PeriodoKey = '7d' | '30d' | 'mes' | 'custom'

function toISODate(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

// ─── Types ────────────────────────────────────────────────────────────────────

type Consultor = {
  nome: string
  deals: number
  dealsPerdidos: number
  dealsAbertos: number
  receita: number
  leads: number
  leadsHoje: number
  taxaConversao: number
  tempMedioFechamento: number
}

type ClintData = {
  mes: string
  receita: number
  totalDeals: number
  totalLeads: number
  leadsHoje: number
  totalLost: number
  taxaConversao: number
  consultores: Consultor[]
}

type MetaVendedor = {
  vendedor: string; mes: string; meta: number; meta_leads: number
  meta_conversao: number; meta_ticket: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentMes() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function getExpectedPct(start: string, end: string) {
  const mes = start.slice(0, 7)
  if (mes !== getCurrentMes()) return 100
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Math.min((now.getDate() / daysInMonth) * 100, 100)
}
function formatMesLabel(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${months[m - 1]} ${y}`
}
function formatPeriodoLabel(start: string, end: string) {
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const today = toISODate(new Date())
  if (start === today && end === today) return 'Hoje'
  if (start === end) return fmt(start)
  const startM = start.slice(0, 7)
  const endM   = end.slice(0, 7)
  if (startM === endM) return formatMesLabel(startM)
  return `${fmt(start)} – ${fmt(end)}`
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, badge, icon: Icon, color, colorClass, bgClass, compact, progress }: {
  label: string; value: string; sub?: string; badge?: { text: string; positive: boolean }
  icon: React.ElementType; color: string; colorClass: string; bgClass: string; compact?: boolean
  progress?: { pct: number; colorClass: string }
}) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl ${compact ? 'p-4' : 'p-5'}`} style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider leading-none">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgClass}`}><Icon className={`w-3.5 h-3.5 ${colorClass}`} /></div>
      </div>
      <p className={`text-white font-bold leading-tight ${compact ? 'text-xl' : 'text-2xl'}`}>{value}</p>
      {progress && (
        <div className="mt-2 mb-1 w-full bg-zinc-800 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${progress.colorClass}`} style={{ width: `${Math.min(progress.pct, 100)}%` }} />
        </div>
      )}
      {(sub || badge) && (
        <div className="flex items-center justify-between mt-1">
          {sub && sub.includes('\n') ? (
            sub.split('\n').map((line, i) => (
              <p key={i} className="text-zinc-500 text-xs truncate">{line}</p>
            ))
          ) : sub && <p className="text-zinc-500 text-xs truncate">{sub}</p>}
          {badge && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ml-auto flex-shrink-0 ${badge.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {badge.text}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── KpiCardTV ────────────────────────────────────────────────────────────────

function KpiCardTV({ label, value, sub, badge, icon: Icon, color, colorClass, bgClass }: {
  label: string; value: string; sub?: string; badge?: { text: string; positive: boolean }
  icon: React.ElementType; color: string; colorClass: string; bgClass: string
}) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 border-t-2 rounded-xl p-3" style={{ borderTopColor: color }}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-zinc-400 text-[11px] font-medium uppercase tracking-widest leading-none">{label}</p>
        <div className={`p-1.5 rounded-lg ${bgClass}`}><Icon className={`w-3.5 h-3.5 ${colorClass}`} /></div>
      </div>
      <p className="text-white font-bold text-2xl leading-none">{value}</p>
      {(sub || badge) && (
        <div className="flex items-center justify-between mt-1">
          {sub && <p className="text-zinc-500 text-[11px] truncate">{sub}</p>}
          {badge && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ml-auto flex-shrink-0 ${badge.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {badge.text}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, target, expectedPct, colorClass, showExpectedLabel, formatValue }: {
  value: number; target: number; expectedPct: number; colorClass: string
  showExpectedLabel?: boolean; formatValue?: (n: number) => string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  const ahead = pct >= expectedPct
  const expectedValue = target * expectedPct / 100
  const diff = value - expectedValue
  const dotLeft = Math.min(expectedPct, 97)

  return (
    <div className="relative w-full mt-3 mb-1">
      {/* Label flutuante acima do pontinho */}
      {target > 0 && expectedPct > 0 && expectedPct < 100 && showExpectedLabel && (
        <div
          className="absolute -top-5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${dotLeft}%` }}
        >
          <span className={`text-[10px] font-semibold whitespace-nowrap ${ahead ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {formatValue ? formatValue(expectedValue) : expectedValue.toFixed(0)}
          </span>
        </div>
      )}

      {/* Barra */}
      <div className="relative w-full bg-zinc-800/80 rounded-full h-1.5 overflow-visible">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />

        {/* Pontinho de onde deveria estar */}
        {target > 0 && expectedPct > 0 && expectedPct < 100 && (
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${dotLeft}%` }}>
            <div className={`w-3 h-3 rounded-full border-2 shadow ${ahead ? 'border-emerald-400 bg-zinc-900' : 'border-zinc-400 bg-zinc-900'}`} />
          </div>
        )}
      </div>

      {/* Gap: falta / adiantado */}
      {target > 0 && expectedPct > 0 && expectedPct < 100 && showExpectedLabel && formatValue && (
        <div className="flex justify-end mt-0.5">
          <span className={`text-[10px] font-semibold ${ahead ? 'text-emerald-400' : 'text-red-400'}`}>
            {ahead ? `+${formatValue(diff)} adiantado` : `${formatValue(Math.abs(diff))} faltando`}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── FunnelBar ───────────────────────────────────────────────────────────────

function FunnelBar({ ganhos, perdidos, abertos, total }: {
  ganhos: number; perdidos: number; abertos: number; total: number
}) {
  if (total === 0) return null
  const pGanhos   = (ganhos / total) * 100
  const pPerdidos = (perdidos / total) * 100
  const pAbertos  = (abertos / total) * 100
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-zinc-800 gap-px">
      {pGanhos   > 0 && <div className="bg-emerald-500" style={{ width: `${pGanhos}%` }} />}
      {pAbertos  > 0 && <div className="bg-blue-500" style={{ width: `${pAbertos}%` }} />}
      {pPerdidos > 0 && <div className="bg-red-500/70" style={{ width: `${pPerdidos}%` }} />}
    </div>
  )
}

// ─── KPIItem ─────────────────────────────────────────────────────────────────

function KPIItem({ label, value, colorClass, sub }: {
  label: string; value: string; colorClass?: string; sub?: string
}) {
  return (
    <div className="flex flex-col items-center text-center gap-0.5 min-w-0">
      <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider leading-none">{label}</span>
      <span className={`font-bold text-sm leading-tight ${colorClass ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-zinc-600 text-[10px] leading-none">{sub}</span>}
    </div>
  )
}

// ─── ProgressMetric ──────────────────────────────────────────────────────────

function ProgressMetric({
  label, value, target, expectedPct, colorBar, formatValue,
  rightTop, rightBottom, bottomLeft, leadsHoje,
}: {
  label: string; value: number; target: number; expectedPct: number; colorBar: string
  formatValue: (n: number) => string; rightTop?: string; rightBottom?: string
  bottomLeft?: React.ReactNode; leadsHoje?: number
}) {
  const pctMeta = target > 0 ? (value / target) * 100 : 0
  const pctRitmo = expectedPct > 0 ? (pctMeta / expectedPct) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-zinc-400 text-xs font-medium">{label}</span>
        <div className="flex items-center gap-2">
          {rightTop && (
            <span className={`text-xs font-semibold ${pctMeta >= 100 ? 'text-emerald-400' : pctMeta >= expectedPct ? 'text-yellow-400' : 'text-zinc-400'}`}>
              {rightTop}
            </span>
          )}
          {leadsHoje !== undefined && (
            <span className="text-xs text-zinc-500">
              Hoje: <span className={`font-semibold ${leadsHoje > 0 ? 'text-violet-400' : 'text-zinc-600'}`}>{leadsHoje}</span>
            </span>
          )}
        </div>
      </div>
      <ProgressBar value={value} target={target} expectedPct={expectedPct} colorClass={colorBar} showExpectedLabel formatValue={formatValue} />
      <div className="flex items-center justify-between">
        <span className="text-xs">{bottomLeft ?? <span className="text-zinc-500">{formatValue(value) + (target > 0 ? ` / ${formatValue(target)}` : '')}</span>}</span>
      </div>
    </div>
  )
}

// ─── Insights ────────────────────────────────────────────────────────────────

type Insight = { tipo: 'positivo' | 'alerta' | 'atencao'; texto: string }

function gerarInsights(
  v: Consultor,
  meta: number,
  meta_leads: number,
  meta_conversao: number,
  meta_ticket: number,
  expectedPct: number,
): Insight[] {
  const insights: Insight[] = []
  const pctMeta   = meta > 0 ? (v.receita / meta) * 100 : null
  const pctLeads  = meta_leads > 0 ? (v.leads / meta_leads) * 100 : null
  const ticket    = v.deals > 0 ? v.receita / v.deals : 0

  // Ritmo de receita
  if (pctMeta !== null && expectedPct > 20) {
    if (pctMeta < expectedPct * 0.6) {
      insights.push({ tipo: 'alerta', texto: 'Ritmo muito abaixo — risco alto de não bater a meta no mês' })
    } else if (pctMeta >= expectedPct * 0.9 && pctMeta < 100) {
      insights.push({ tipo: 'atencao', texto: 'No ritmo, mas sem folga — manter pressão até o fim do mês' })
    } else if (pctMeta >= 100) {
      insights.push({ tipo: 'positivo', texto: 'Meta batida! 🎉 Cada novo contrato é bônus' })
    } else if (pctMeta >= expectedPct) {
      insights.push({ tipo: 'positivo', texto: 'No ritmo certo — continuar assim para fechar bem' })
    }
  }

  // Prospecção / leads
  if (pctLeads !== null && expectedPct > 20) {
    if (pctLeads < 60) {
      insights.push({ tipo: 'alerta', texto: 'Prospecção abaixo do ritmo — aumentar captação diária de leads' })
    } else if (pctLeads >= 100) {
      insights.push({ tipo: 'positivo', texto: 'Meta de prospecção batida — volume de leads saudável' })
    }
  }

  // Taxa de conversão vs meta e prospecção
  if (meta_conversao > 0 && v.leads >= 5) {
    if (v.taxaConversao < meta_conversao * 0.7) {
      if (pctLeads !== null && pctLeads >= 85) {
        insights.push({ tipo: 'alerta', texto: 'Prospecta bem, mas conversão baixa — revisar abordagem e discurso' })
      } else {
        insights.push({ tipo: 'alerta', texto: 'Conversão abaixo da meta — avaliar qualidade dos leads recebidos' })
      }
    } else if (v.taxaConversao >= meta_conversao) {
      insights.push({ tipo: 'positivo', texto: `Boa conversão (${v.taxaConversao.toFixed(1)}%) — fechamento eficiente` })
    }
  } else if (meta_conversao === 0 && v.leads >= 5 && v.taxaConversao < 15) {
    insights.push({ tipo: 'atencao', texto: 'Conversão abaixo de 15% — vale analisar a qualidade dos leads' })
  }

  // Ticket médio
  if (meta_ticket > 0 && ticket > 0 && ticket < meta_ticket * 0.8) {
    insights.push({ tipo: 'atencao', texto: 'Ticket médio abaixo da meta — focar em contratos de maior valor' })
  }

  // Pipeline travado
  if (v.dealsAbertos > 0 && v.dealsAbertos >= v.deals * 3 && v.dealsAbertos >= 5) {
    insights.push({ tipo: 'atencao', texto: `${v.dealsAbertos} leads em aberto — pipeline pode estar travado` })
  }

  // Sem dados suficientes
  if (v.leads === 0) {
    insights.push({ tipo: 'atencao', texto: 'Nenhum lead registrado no período selecionado' })
  }

  return insights.slice(0, 3)
}

function InsightChip({ insight }: { insight: Insight }) {
  const styles: Record<Insight['tipo'], string> = {
    positivo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    alerta:   'bg-red-500/10 text-red-400 border-red-500/20',
    atencao:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }
  const icons: Record<Insight['tipo'], string> = {
    positivo: '✓',
    alerta:   '!',
    atencao:  '~',
  }
  return (
    <div className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 ${styles[insight.tipo]}`}>
      <span className="font-bold text-[10px] leading-tight mt-px flex-shrink-0">{icons[insight.tipo]}</span>
      <span className="text-[11px] leading-tight">{insight.texto}</span>
    </div>
  )
}

// ─── ConsultantCard ───────────────────────────────────────────────────────────

function ConsultantCard({
  v, rank, totalReceita, meta, meta_leads, meta_conversao, meta_ticket,
  expectedPct, editandoMeta, editMetaReceita, editMetaLeads,
  onEditStart, onEditMetaReceita, onEditMetaLeads, onEditSave, onEditCancel,
}: {
  v: Consultor; rank: number; totalReceita: number; meta: number; meta_leads: number
  meta_conversao: number; meta_ticket: number; expectedPct: number; editandoMeta: boolean
  editMetaReceita: string; editMetaLeads: string; onEditStart: () => void
  onEditMetaReceita: (v: string) => void; onEditMetaLeads: (v: string) => void
  onEditSave: () => void; onEditCancel: () => void
}) {
  const ticket       = v.deals > 0 ? v.receita / v.deals : 0
  const pctReceita   = totalReceita > 0 ? (v.receita / totalReceita) * 100 : 0
  const pctMeta      = meta > 0 ? (v.receita / meta) * 100 : 0
  const pctRitmoRec  = expectedPct > 0 ? (pctMeta / expectedPct) * 100 : 0
  const pctLeads     = meta_leads > 0 ? (v.leads / meta_leads) * 100 : 0
  const medalha      = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const totalFunil   = v.deals + v.dealsPerdidos + v.dealsAbertos

  const barReceita = meta > 0
    ? (pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= expectedPct ? 'bg-yellow-500' : 'bg-amber-500/70')
    : 'bg-zinc-600'
  const barLeads = pctLeads >= 100 ? 'bg-emerald-500' : 'bg-cyan-500'

  return (
    <div className={`bg-zinc-900 border rounded-xl overflow-hidden flex flex-col ${rank === 1 ? 'border-yellow-500/40' : 'border-zinc-800'}`}>

      {/* ── Header ── */}
      <div className={`px-4 pt-4 pb-3 ${rank === 1 ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {medalha ? (
              <span className="text-xl flex-shrink-0 leading-none">{medalha}</span>
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                <span className="text-zinc-400 text-xs font-bold">{rank}</span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-white font-bold text-sm leading-tight truncate">{v.nome}</h3>
              <p className="text-zinc-500 text-[11px]">
                {pctReceita > 0 ? `${pctReceita.toFixed(1)}% da receita` : 'sem receita'}
              </p>
            </div>
          </div>

          {editandoMeta ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="text" inputMode="decimal" value={editMetaReceita}
                onChange={e => onEditMetaReceita(e.target.value)}
                className="w-20 bg-zinc-800 border border-zinc-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                placeholder="R$ meta" autoFocus
              />
              <input
                type="text" inputMode="numeric" value={editMetaLeads}
                onChange={e => onEditMetaLeads(e.target.value)}
                className="w-14 bg-zinc-800 border border-zinc-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                placeholder="leads"
              />
              <button onClick={onEditSave} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={onEditCancel} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button onClick={onEditStart} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0">
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Barras de progresso ── */}
      <div className="px-4 pb-3 space-y-3">
        <ProgressMetric
          label={L.receita} value={v.receita} target={meta} expectedPct={expectedPct}
          colorBar={barReceita} formatValue={formatCurrency}
          rightTop={meta > 0 ? `${pctMeta.toFixed(0)}% da meta` : undefined}
          rightBottom={meta > 0 && expectedPct > 0 ? `${pctRitmoRec.toFixed(0)}% ritmo` : undefined}
          bottomLeft={
            meta > 0 ? (
              <span className="flex items-center gap-1">
                <span className={pctMeta >= 100 ? 'text-emerald-400' : pctMeta >= expectedPct ? 'text-yellow-400' : 'text-zinc-300'}>
                  {formatCurrency(v.receita)}
                </span>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-600">meta {formatCurrency(meta)}</span>
              </span>
            ) : formatCurrency(v.receita)
          }
        />
        <ProgressMetric
          label={L.leadsRecebidos} value={v.leads} target={meta_leads} expectedPct={expectedPct}
          colorBar={barLeads} formatValue={n => String(n)}
          rightTop={meta_leads > 0 ? `${pctLeads.toFixed(0)}% da meta` : undefined}
          leadsHoje={v.leadsHoje}
          bottomLeft={meta_leads > 0 ? `${v.leads} / ${meta_leads} meta` : `${v.leads} leads`}
        />
      </div>

      {/* ── Divisor ── */}
      <div className="mx-4 border-t border-zinc-800/70" />

      {/* ── KPIs ── */}
      <div className="px-4 py-3 grid grid-cols-4 gap-x-1 gap-y-2">
        <KPIItem label={L.ganhos}        value={String(v.deals)}           colorClass="text-emerald-300" />
        <KPIItem label={L.ticketMedio}   value={formatCurrency(ticket)}
          colorClass={meta_ticket > 0 ? (ticket >= meta_ticket ? 'text-emerald-400' : 'text-red-400') : 'text-white'}
          sub={meta_ticket > 0 ? `m: ${formatCurrency(meta_ticket)}` : undefined}
        />
        <KPIItem label={L.conversaoAbrev} value={`${v.taxaConversao.toFixed(1)}%`}
          colorClass={meta_conversao > 0 ? (v.taxaConversao >= meta_conversao ? 'text-emerald-400' : 'text-red-400') : 'text-white'}
          sub={meta_conversao > 0 ? `m: ${meta_conversao.toFixed(1)}%` : undefined}
        />
        <KPIItem label={L.ciclo}        value={v.tempMedioFechamento > 0 ? `${v.tempMedioFechamento.toFixed(1)}d` : '—'} colorClass="text-zinc-300" />
        <KPIItem label={L.leadsAbertos} value={String(v.dealsAbertos)} colorClass="text-blue-400" />
        <KPIItem label={L.perdidos}     value={String(v.dealsPerdidos)} colorClass="text-red-400/80" />
        <KPIItem label={L.leadsHoje}    value={String(v.leadsHoje)} colorClass={v.leadsHoje > 0 ? 'text-violet-400' : 'text-zinc-600'} />
      </div>

      {/* ── Mini funil ── */}
      {totalFunil > 0 && (
        <div className="px-4 pb-3">
          <FunnelBar ganhos={v.deals} perdidos={v.dealsPerdidos} abertos={v.dealsAbertos} total={v.leads || totalFunil} />
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-emerald-400 font-medium">{v.deals} ganhos</span>
            <span className="text-[10px] text-blue-400">{v.dealsAbertos} abertos</span>
            <span className="text-[10px] text-red-400/70">{v.dealsPerdidos} perdidos</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ConsultantCardTV ─────────────────────────────────────────────────────────

function ConsultantCardTV({ v, rank, totalReceita, meta, meta_leads, expectedPct }: {
  v: Consultor; rank: number; totalReceita: number; meta: number; meta_leads: number; expectedPct: number
}) {
  const pctReceita = totalReceita > 0 ? (v.receita / totalReceita) * 100 : 0
  const pctMeta    = meta > 0 ? (v.receita / meta) * 100 : 0
  const pctLeads   = meta_leads > 0 ? (v.leads / meta_leads) * 100 : 0
  const medalha    = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const barReceita = meta > 0 ? (pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= expectedPct ? 'bg-yellow-500' : 'bg-amber-500/70') : 'bg-zinc-600'

  return (
    <div className={`bg-zinc-900/90 border rounded-xl p-3 flex flex-col ${rank === 1 ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 to-transparent' : 'border-zinc-800'}`}>
      {/* Header compacto */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {medalha ? <span className="text-xl leading-none flex-shrink-0">{medalha}</span> : (
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
              <span className="text-zinc-400 text-[11px] font-bold">{rank}</span>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-white font-bold text-sm leading-tight truncate">{v.nome}</h3>
            <p className="text-zinc-500 text-[11px]">{pctReceita > 0 ? `${pctReceita.toFixed(1)}% da receita` : 'sem receita'}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {meta > 0
            ? <p className="text-zinc-400 text-xs font-semibold">{pctMeta.toFixed(0)}% meta</p>
            : <p className="text-emerald-400 font-bold text-base">{formatCurrency(v.receita)}</p>
          }
        </div>
      </div>

      {/* Barra receita */}
      {meta > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
            <span>{formatCurrency(v.receita)}</span><span>meta {formatCurrency(meta)}</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${barReceita}`} style={{ width: `${Math.min(pctMeta, 100)}%` }} />
          </div>
        </div>
      )}

      {/* KPIs compactos */}
      <div className="grid grid-cols-4 gap-1 mt-1.5">
        {[
          { label: L.ganhos,         value: String(v.deals),                   color: 'text-emerald-400' },
          { label: L.leadsRecebidos, value: String(v.leads),                   color: 'text-white' },
          { label: L.leadsHoje,      value: String(v.leadsHoje),               color: v.leadsHoje > 0 ? 'text-violet-400' : 'text-zinc-600' },
          { label: L.conversaoAbrev, value: `${v.taxaConversao.toFixed(1)}%`,  color: 'text-cyan-400' },
        ].map(k => (
          <div key={k.label} className="bg-zinc-800/50 rounded-lg py-1.5 px-1 text-center">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wide leading-none mb-0.5">{k.label}</p>
            <p className={`font-bold text-base leading-tight ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barra leads */}
      {meta_leads > 0 && (
        <div className="mt-1.5">
          <div className="flex justify-between text-[11px] text-zinc-500 mb-0.5">
            <span>{L.leadsRecebidos}</span><span>{v.leads} / {meta_leads}</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1">
            <div className={`h-1 rounded-full ${pctLeads >= 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min(pctLeads, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inner ────────────────────────────────────────────────────────────────────

function ConsultoresInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const todayDate    = new Date()
  const today        = toISODate(todayDate)
  const firstOfMonth = toISODate(startOfMonth(todayDate))
  const start        = searchParams.get('start') || firstOfMonth
  const end          = searchParams.get('end')   || today
  const mes          = toISODate(startOfMonth(todayDate)).slice(0, 7) // sempre mês atual para metas

  const [periodo, setPeriodo]         = useState<PeriodoKey>('mes')
  const [customStart, setCustomStart] = useState(firstOfMonth)
  const [customEnd, setCustomEnd]     = useState(today)
  const [showCustom, setShowCustom]   = useState(false)
  const [tvMode, setTvMode]           = useState(false)
  const tvRef = useRef<HTMLDivElement>(null)

  function setPeriodoDatas(p: PeriodoKey, cs?: string, ce?: string) {
    let s = firstOfMonth, e = today
    if (p === '7d')    { s = toISODate(addDays(todayDate, -6)); e = today }
    if (p === '30d')   { s = toISODate(addDays(todayDate, -29)); e = today }
    if (p === 'mes')   { s = firstOfMonth; e = today }
    if (p === 'custom') { s = cs ?? customStart; e = ce ?? customEnd }
    const params = new URLSearchParams(searchParams.toString())
    params.set('start', s); params.set('end', e)
    router.push(`${pathname}?${params.toString()}`)
  }

  const [data, setData]                   = useState<ClintData | null>(null)
  const [metas, setMetas]                 = useState<MetaVendedor[]>([])
  const [loading, setLoading]             = useState(true)
  const [loadError, setLoadError]         = useState(false)
  const [lastSync, setLastSync]           = useState('')
  const [trafego, setTrafego]             = useState(0)
  const [loadingTrafego, setLoadingTrafego] = useState(true)
  const [editandoMeta, setEditandoMeta]   = useState<string | null>(null)
  const [editMetaReceita, setEditMetaReceita] = useState('')
  const [editMetaLeads, setEditMetaLeads]     = useState('')

  const load = useCallback(async (s: string, e: string) => {
    const m = s.slice(0, 7)
    setLoading(true); setLoadError(false); setLoadingTrafego(true)
    setData(null); setMetas([]); setTrafego(0)
    try {
      const ctrl = new AbortController()
      const tout = setTimeout(() => ctrl.abort(), 30000)
      const [r, mr] = await Promise.all([
        fetch(`/api/clint?mes=${m}&start=${s}&end=${e}&t=${Date.now()}`, { signal: ctrl.signal }),
        fetch(`/api/metas-vendedor?mes=${m}`),
      ])
      clearTimeout(tout)
      const [json, metasJson] = await Promise.all([r.json(), mr.json()])
      if (!json.error) { setData(json); setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) }
      else setLoadError(true)
      setMetas(Array.isArray(metasJson) ? metasJson : [])
    } catch { setLoadError(true) }
    setLoading(false)
    try {
      const sv = await fetch(`/api/integrations/meta-vendedores?start=${s}&end=${e}`)
      const svJson = await sv.json()
      setTrafego(svJson.totalSpend ?? 0)
    } catch { /* tráfego indisponível */ }
    setLoadingTrafego(false)
  }, [])

  useEffect(() => { load(start, end) }, [start, end, load])

  // TV mode: fullscreen + auto-refresh a cada 60s
  useEffect(() => {
    if (!tvMode) return
    const interval = setInterval(() => load(start, end), 60000)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTvMode(false) }
    document.addEventListener('keydown', onKey)
    try { document.documentElement.requestFullscreen?.() } catch {}
    return () => { clearInterval(interval); document.removeEventListener('keydown', onKey) }
  }, [tvMode, start, end, load])

  useEffect(() => {
    if (!tvMode && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [tvMode])

  async function salvarMeta(nome: string) {
    const meta       = parseFloat(editMetaReceita) || 0
    const meta_leads = parseInt(editMetaLeads) || 0
    await fetch('/api/metas-vendedor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedor: nome, mes, meta, meta_leads }),
    })
    setMetas(prev => {
      const exists = prev.find(m => m.vendedor === nome)
      if (exists) return prev.map(m => m.vendedor === nome ? { ...m, meta, meta_leads } : m)
      return [...prev, { vendedor: nome, mes, meta, meta_leads, meta_conversao: 0, meta_ticket: 0 }]
    })
    setEditandoMeta(null)
  }

  function normalizarNome(n: string) {
    return n.replace(/#\d*\s*/g, '').replace(/[#@!]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  }
  function getMeta(nome: string) {
    const nomeNorm = normalizarNome(nome)
    return metas.find(m => normalizarNome(m.vendedor) === nomeNorm) ?? { meta: 0, meta_leads: 0, meta_conversao: 0, meta_ticket: 0 }
  }

  const consultores    = data?.consultores ?? []
  const totalReceita   = data?.receita ?? 0
  const totalDeals     = data?.totalDeals ?? 0
  const totalLeads     = consultores.reduce((s, c) => s + (c.leads || 0), 0)
  const totalLost      = data?.totalLost ?? 0
  const leadsHoje      = data?.leadsHoje ?? 0
  const taxaConversao  = data?.taxaConversao ?? 0
  const ticketMedio    = totalDeals > 0 ? totalReceita / totalDeals : 0
  const totalSpend     = trafego
  const expectedPctGeral = getExpectedPct(start, end)
  const metaTotal      = consultores.reduce((s, c) => s + (getMeta(c.nome).meta || 0), 0)
  const metaLeadsTotal = consultores.reduce((s, c) => s + (getMeta(c.nome).meta_leads || 0), 0)
  const expectedReceita = metaTotal * (expectedPctGeral / 100)
  const expectedLeads   = metaLeadsTotal * (expectedPctGeral / 100)
  const receitaPaceRatio = expectedReceita > 0 ? (totalReceita / expectedReceita) * 100 : 0
  const pctMetaGeral     = metaTotal > 0 ? (totalReceita / metaTotal) * 100 : 0
  const barMetaColor     = pctMetaGeral >= expectedPctGeral ? 'bg-emerald-500' : pctMetaGeral >= expectedPctGeral * 0.8 ? 'bg-yellow-500' : 'bg-red-500/70'
  const leadsPaceRatio   = expectedLeads   > 0 ? (totalLeads / expectedLeads) * 100 : 0
  const consultoresComMetaConversao = consultores.filter(c => getMeta(c.nome).meta_conversao > 0)
  const consultoresComMetaTicket    = consultores.filter(c => getMeta(c.nome).meta_ticket    > 0)
  const avgMetaConversao = consultoresComMetaConversao.length > 0
    ? consultoresComMetaConversao.reduce((s, c) => s + getMeta(c.nome).meta_conversao, 0) / consultoresComMetaConversao.length : 0
  const avgMetaTicket = consultoresComMetaTicket.length > 0
    ? consultoresComMetaTicket.reduce((s, c) => s + getMeta(c.nome).meta_ticket, 0) / consultoresComMetaTicket.length : 0
  const tempMedioGeral = consultores.length > 0
    ? consultores.filter(c => c.tempMedioFechamento > 0).reduce((s, c) => s + c.tempMedioFechamento, 0) /
      Math.max(1, consultores.filter(c => c.tempMedioFechamento > 0).length) : 0

  // Metas fixas da equipe
  const META_CONVERSAO    = 5      // %
  const META_LEADS_MES    = 2000
  const META_LEADS_DIA    = 100

  const pctConversao      = taxaConversao / META_CONVERSAO * 100
  const diffConversao     = taxaConversao - META_CONVERSAO
  const barConversaoColor = taxaConversao >= META_CONVERSAO ? 'bg-emerald-500' : taxaConversao >= META_CONVERSAO * 0.8 ? 'bg-yellow-500' : 'bg-red-500/70'
  const colorConversao    = taxaConversao >= META_CONVERSAO ? '#10B981' : taxaConversao >= META_CONVERSAO * 0.8 ? '#EAB308' : '#EF4444'

  const pctLeadsMes       = (totalLeads / META_LEADS_MES) * 100
  const leadsEsperados    = META_LEADS_MES * (expectedPctGeral / 100)
  const diffLeads         = totalLeads - leadsEsperados
  const barLeadsColor     = totalLeads >= leadsEsperados ? 'bg-violet-500' : totalLeads >= leadsEsperados * 0.8 ? 'bg-yellow-500' : 'bg-red-500/70'
  const colorLeads        = totalLeads >= leadsEsperados ? '#8B5CF6' : totalLeads >= leadsEsperados * 0.8 ? '#EAB308' : '#EF4444'

  const pctLeadsDia       = Math.min((leadsHoje / META_LEADS_DIA) * 100, 100)
  const barLeadsDiaColor  = leadsHoje >= META_LEADS_DIA ? 'bg-violet-500' : leadsHoje >= META_LEADS_DIA * 0.8 ? 'bg-yellow-500' : 'bg-red-500/70'
  const colorLeadsDia     = leadsHoje >= META_LEADS_DIA ? '#8B5CF6' : leadsHoje >= META_LEADS_DIA * 0.8 ? '#EAB308' : '#EF4444'

  const kpiCards = [
    { label: L.receitaTotal, value: loading ? '...' : formatCurrency(totalReceita),
      sub: undefined, badge: undefined,
      icon: DollarSign, color: '#10B981', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
    ...(metaTotal > 0 ? [{
      label: 'Meta de Receita',
      value: loading ? '...' : formatCurrency(metaTotal),
      sub: loading ? undefined : (() => {
        const diff = totalReceita - expectedReceita
        if (expectedReceita <= 0) return `${pctMetaGeral.toFixed(1)}% atingido`
        return diff >= 0
          ? `+${formatCurrency(diff)} acima do ritmo esperado`
          : `${formatCurrency(Math.abs(diff))} abaixo do ritmo esperado`
      })(),
      badge: undefined,
      icon: TrendingUp, color: pctMetaGeral >= expectedPctGeral ? '#10B981' : pctMetaGeral >= expectedPctGeral * 0.8 ? '#EAB308' : '#EF4444',
      colorClass: pctMetaGeral >= expectedPctGeral ? 'text-emerald-400' : pctMetaGeral >= expectedPctGeral * 0.8 ? 'text-yellow-400' : 'text-red-400',
      bgClass: pctMetaGeral >= expectedPctGeral ? 'bg-emerald-500/10' : pctMetaGeral >= expectedPctGeral * 0.8 ? 'bg-yellow-500/10' : 'bg-red-500/10',
      progress: { pct: pctMetaGeral, colorClass: barMetaColor },
    }] : []),
    { label: 'Leads do Mês',
      value: loading ? '...' : formatNumber(totalLeads),
      sub: loading ? undefined : (() => {
        if (diffLeads >= 0) return `+${Math.round(diffLeads)} acima do ritmo esperado`
        return `${Math.round(Math.abs(diffLeads))} abaixo do ritmo esperado`
      })(),
      badge: undefined,
      icon: Users, color: colorLeads,
      colorClass: totalLeads >= leadsEsperados ? 'text-violet-400' : totalLeads >= leadsEsperados * 0.8 ? 'text-yellow-400' : 'text-red-400',
      bgClass: totalLeads >= leadsEsperados ? 'bg-violet-500/10' : totalLeads >= leadsEsperados * 0.8 ? 'bg-yellow-500/10' : 'bg-red-500/10',
      progress: { pct: pctLeadsMes, colorClass: barLeadsColor },
    },
    { label: 'Taxa de Conversão',
      value: loading ? '...' : `${taxaConversao.toFixed(1)}%`,
      sub: loading ? undefined : (() => {
        if (diffConversao >= 0) return `+${diffConversao.toFixed(1)}pp acima da meta de ${META_CONVERSAO}%`
        return `${Math.abs(diffConversao).toFixed(1)}pp abaixo da meta de ${META_CONVERSAO}%`
      })(),
      badge: undefined,
      icon: Target, color: colorConversao,
      colorClass: taxaConversao >= META_CONVERSAO ? 'text-cyan-400' : taxaConversao >= META_CONVERSAO * 0.8 ? 'text-yellow-400' : 'text-red-400',
      bgClass: taxaConversao >= META_CONVERSAO ? 'bg-cyan-500/10' : taxaConversao >= META_CONVERSAO * 0.8 ? 'bg-yellow-500/10' : 'bg-red-500/10',
      progress: { pct: Math.min(pctConversao, 100), colorClass: barConversaoColor },
    },
    { label: L.trafego, value: loadingTrafego ? '...' : formatCurrency(totalSpend),
      sub: undefined, badge: undefined,
      icon: TrendingUp, color: '#F97316', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/10' },
    { label: 'Leads Hoje',
      value: loading ? '...' : String(leadsHoje),
      sub: loading ? undefined : leadsHoje >= META_LEADS_DIA
        ? `Meta de ${META_LEADS_DIA} batida! ✓`
        : `${META_LEADS_DIA - leadsHoje} faltando para ${META_LEADS_DIA}`,
      badge: undefined,
      icon: CalendarCheck, color: colorLeadsDia,
      colorClass: leadsHoje >= META_LEADS_DIA ? 'text-violet-400' : leadsHoje >= META_LEADS_DIA * 0.8 ? 'text-yellow-400' : 'text-red-400',
      bgClass: leadsHoje >= META_LEADS_DIA ? 'bg-violet-500/10' : leadsHoje >= META_LEADS_DIA * 0.8 ? 'bg-yellow-500/10' : 'bg-red-500/10',
      progress: { pct: pctLeadsDia, colorClass: barLeadsDiaColor },
    },
  ]

  // ── Modo TV ───────────────────────────────────────────────────────────────
  if (tvMode) {
    const tvCols = consultores.length <= 3 ? consultores.length
      : consultores.length <= 6 ? 3
      : consultores.length <= 8 ? 4
      : consultores.length <= 12 ? 4
      : 5

    return (
      <div ref={tvRef} className="fixed inset-0 z-50 bg-zinc-950 flex flex-col overflow-hidden">
        {/* Header TV */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-sm tracking-tight">Consultores BPX</h1>
            <span className="text-zinc-700 text-xs">·</span>
            <p className="text-zinc-400 text-xs">{formatPeriodoLabel(start, end)}</p>
            {lastSync && <p className="text-zinc-600 text-xs">{lastSync}</p>}
          </div>
          <div className="flex items-center gap-2">
            {loading && <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin" />}
            <button onClick={() => setTvMode(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors">
              <X className="w-3 h-3" /> Sair
            </button>
          </div>
        </div>

        {/* KPIs TV — uma linha */}
        <div className="flex-shrink-0 px-3 pt-2 pb-1.5">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${kpiCards.length}, minmax(0, 1fr))` }}>
            {kpiCards.map(k => (
              <KpiCardTV key={k.label} {...k} />
            ))}
          </div>
        </div>

        {/* Consultores TV — preenche o resto da tela */}
        {consultores.length > 0 && (
          <div className="flex-1 px-3 pb-3 min-h-0 overflow-y-auto">
            <div className="grid gap-2 h-full" style={{
              gridTemplateColumns: `repeat(${tvCols}, 1fr)`,
              gridAutoRows: `1fr`,
            }}>
              {consultores.map((v, i) => {
                const { meta, meta_leads, meta_conversao, meta_ticket } = getMeta(v.nome)
                return (
                  <ConsultantCard key={v.nome} v={v} rank={i+1} totalReceita={totalReceita}
                    meta={meta} meta_leads={meta_leads} meta_conversao={meta_conversao} meta_ticket={meta_ticket}
                    expectedPct={getExpectedPct(start, end)}
                    editandoMeta={editandoMeta === v.nome} editMetaReceita={editMetaReceita} editMetaLeads={editMetaLeads}
                    onEditStart={() => { setEditandoMeta(v.nome); setEditMetaReceita(String(getMeta(v.nome).meta || '')); setEditMetaLeads(String(getMeta(v.nome).meta_leads || '')) }}
                    onEditMetaReceita={setEditMetaReceita} onEditMetaLeads={setEditMetaLeads}
                    onEditSave={() => salvarMeta(v.nome)} onEditCancel={() => setEditandoMeta(null)}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Modo Normal ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Consultores" lastSync={loading ? 'carregando...' : `atualizado às ${lastSync}`} />

      <div className="p-4 space-y-4">

        {/* ── Filtro de período + botão TV ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {([
              { key: '7d',     label: '7 dias' },
              { key: '30d',    label: '30 dias' },
              { key: 'mes',    label: 'Este mês' },
              { key: 'custom', label: 'Personalizado' },
            ] as { key: PeriodoKey; label: string }[]).map(op => (
              <button key={op.key}
                onClick={() => { setPeriodo(op.key); setShowCustom(op.key === 'custom'); if (op.key !== 'custom') setPeriodoDatas(op.key) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodo === op.key ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                {op.label}
              </button>
            ))}
          </div>

          {showCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart}
                onChange={e => { setCustomStart(e.target.value); setPeriodoDatas('custom', e.target.value, customEnd) }}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
              <span className="text-zinc-600 text-xs">até</span>
              <input type="date" value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); setPeriodoDatas('custom', customStart, e.target.value) }}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-zinc-500 text-xs hidden sm:block">{formatPeriodoLabel(start, end)}</span>
            <button onClick={() => setTvMode(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-blue-400 hover:border-blue-500/40 text-xs transition-colors">
              <Tv className="w-3.5 h-3.5" /> Modo TV
            </button>
            <button onClick={() => load(start, end)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* ── KPIs — 6 em linha ── */}
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-3">
          {kpiCards.map(k => (
            <KpiCard key={k.label} {...k} compact />
          ))}
        </div>

        {/* ── Funil geral ── */}
        {!loading && totalLeads > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">Funil de Pipeline — {formatPeriodoLabel(start, end)}</h3>
              {tempMedioGeral > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  Ciclo médio: <span className="text-white font-semibold ml-1">{tempMedioGeral.toFixed(1)} dias</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: L.leads, value: totalLeads,                          color: 'text-white',       bg: 'bg-zinc-800' },
                { label: 'Ganhos',       value: totalDeals,                          color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Em Aberto',    value: totalLeads - totalDeals - totalLost, color: 'text-blue-400',    bg: 'bg-blue-500/10' },
                { label: 'Perdidos',     value: totalLost,                           color: 'text-red-400',     bg: 'bg-red-500/10' },
              ].map(item => (
                <div key={item.label} className={`${item.bg} rounded-xl px-3 py-2 text-center`}>
                  <p className="text-zinc-500 text-[11px] mb-0.5">{item.label}</p>
                  <p className={`font-bold text-base ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <FunnelBar ganhos={totalDeals} perdidos={totalLost} abertos={Math.max(0, totalLeads - totalDeals - totalLost)} total={totalLeads} />
            <div className="flex items-center gap-4 mt-1.5">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Ganhos</span>
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Em aberto</span>
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="w-2 h-2 rounded-full bg-red-500/70 inline-block" />Perdidos</span>
            </div>
          </div>
        )}

        {/* ── Estados ── */}
        {loading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">Carregando dados do pipeline Clint...</p>
          </div>
        ) : loadError ? (
          <div className="bg-zinc-900 border border-red-500/20 rounded-xl p-8 text-center">
            <p className="text-red-400 text-sm font-medium mb-2">Erro ao carregar dados do Clint</p>
            <button onClick={() => load(start, end)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-sm mx-auto transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </button>
          </div>
        ) : consultores.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <Users className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm font-medium">Nenhum deal ganho em {formatPeriodoLabel(start, end)}</p>
          </div>
        ) : (
          <>
            {/* ── Cards por consultor ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {consultores.map((v, i) => {
                const { meta, meta_leads, meta_conversao, meta_ticket } = getMeta(v.nome)
                return (
                  <ConsultantCard key={v.nome} v={v} rank={i + 1} totalReceita={totalReceita}
                    meta={meta} meta_leads={meta_leads} meta_conversao={meta_conversao} meta_ticket={meta_ticket}
                    expectedPct={getExpectedPct(start, end)}
                    editandoMeta={editandoMeta === v.nome} editMetaReceita={editMetaReceita} editMetaLeads={editMetaLeads}
                    onEditStart={() => { setEditandoMeta(v.nome); setEditMetaReceita(String(getMeta(v.nome).meta || '')); setEditMetaLeads(String(getMeta(v.nome).meta_leads || '')) }}
                    onEditMetaReceita={setEditMetaReceita} onEditMetaLeads={setEditMetaLeads}
                    onEditSave={() => salvarMeta(v.nome)} onEditCancel={() => setEditandoMeta(null)}
                  />
                )
              })}
            </div>

            {/* ── Ranking tabela ── */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Ranking — {formatPeriodoLabel(start, end)}</h3>
                <span className="text-zinc-500 text-xs">{consultores.length} consultores</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {['#','Consultor', L.leadsRecebidos, L.leadsHoje, L.ganhos, L.perdidos, L.leadsAbertos, L.conversao, L.receita,'Meta R$','% Meta', L.ticketMedio, L.ciclo].map(h => (
                        <th key={h} className="text-left text-[11px] text-zinc-500 font-medium uppercase tracking-wider py-2.5 px-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {consultores.map((v, i) => {
                      const ticket      = v.deals > 0 ? v.receita / v.deals : 0
                      const { meta }    = getMeta(v.nome)
                      const pctMeta     = meta > 0 ? (v.receita / meta) * 100 : 0
                      const expectedPct = getExpectedPct(start, end)
                      return (
                        <tr key={v.nome} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-2.5 px-3 text-zinc-500 text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}</td>
                          <td className="py-2.5 px-3 text-white font-medium text-sm whitespace-nowrap">{v.nome}</td>
                          <td className="py-2.5 px-3 text-white font-semibold text-sm">{v.leads}</td>
                          <td className="py-2.5 px-3 text-zinc-400 text-sm">{v.leadsHoje}</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold text-sm">{v.deals}</td>
                          <td className="py-2.5 px-3 text-red-400/80 text-sm">{v.dealsPerdidos}</td>
                          <td className="py-2.5 px-3 text-blue-400 text-sm">{v.dealsAbertos}</td>
                          <td className="py-2.5 px-3 text-zinc-300 text-sm">{v.taxaConversao.toFixed(1)}%</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-semibold text-sm">{formatCurrency(v.receita)}</td>
                          <td className="py-2.5 px-3 text-zinc-400 text-sm">{meta > 0 ? formatCurrency(meta) : '—'}</td>
                          <td className="py-2.5 px-3">
                            {meta > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-12">
                                  <ProgressBar value={v.receita} target={meta} expectedPct={expectedPct}
                                    colorClass={pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= expectedPct ? 'bg-yellow-500' : 'bg-blue-500'} />
                                </div>
                                <span className={`text-xs ${pctMeta >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>{pctMeta.toFixed(0)}%</span>
                              </div>
                            ) : <span className="text-zinc-600 text-xs">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300 text-sm">{formatCurrency(ticket)}</td>
                          <td className="py-2.5 px-3 text-zinc-400 text-sm">{v.tempMedioFechamento > 0 ? `${v.tempMedioFechamento.toFixed(1)}d` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pódio */}
              {consultores.length >= 3 && (
                <div className="px-5 py-5 border-t border-zinc-800">
                  <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-4 text-center">Pódio do período</p>
                  <div className="flex items-end justify-center gap-5">
                    {[{ idx: 1, emoji: '🥈', h: 64,  cls: 'bg-zinc-700/50 border-zinc-600 text-zinc-300' },
                      { idx: 0, emoji: '🥇', h: 96,  cls: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' },
                      { idx: 2, emoji: '🥉', h: 48,  cls: 'bg-orange-900/30 border-orange-900/30 text-orange-400' },
                    ].map(p => (
                      <div key={p.idx} className="flex flex-col items-center gap-1.5">
                        <span className="text-2xl">{p.emoji}</span>
                        <div className="text-center">
                          <p className="text-white font-semibold text-sm">{consultores[p.idx].nome.split(' ')[0]}</p>
                          <p className={p.idx === 0 ? 'text-emerald-400 text-xs font-semibold' : 'text-zinc-400 text-xs'}>{formatCurrency(consultores[p.idx].receita)}</p>
                        </div>
                        <div className={`w-20 border rounded-t-lg flex items-center justify-center ${p.cls}`} style={{ height: p.h }}>
                          <span className="font-bold text-xl">{p.idx + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ConsultoresPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-500">Carregando...</div>}>
      <ConsultoresInner />
    </Suspense>
  )
}
