'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import {
  Search,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  MessageCircle,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Servidor = {
  id: string
  orgao: string
  nome: string
  cpf: string
  cidade: string
  estado: string
  margem_disponivel: string | null
  vinculo: string | null
  idade: number | null
  status_consulta: 'ok' | 'nao_encontrado' | 'erro'
  consultado_em: string
  contatado: boolean
  contatado_em: string | null
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, colorClass, bgClass,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; colorClass: string; bgClass: string
}) {
  return (
    <div
      className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5"
      style={{ borderTopColor: color }}
    >
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

// ─── Linha da tabela ──────────────────────────────────────────────────────────


function LinhaServidor({ s, onToggleContato }: { s: Servidor; onToggleContato: (id: string, valor: boolean) => void; }) {
  const margemNum = parseFloat(
    (s.margem_disponivel ?? '').replace(/[^0-9,\-]/g, '').replace(',', '.')
  )
  const margemCls = isNaN(margemNum)
    ? 'text-zinc-500'
    : margemNum > 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <tr className="hover:bg-zinc-800/40 transition-colors">
      <td className="px-5 py-3">
        <p className="text-white text-xs font-medium">{s.nome}</p>
        <p className="text-zinc-500 text-xs mt-0.5">{s.cpf}{s.idade ? ` · ${s.idade} anos` : ''}</p>
        {s.vinculo && s.vinculo !== 'PRINCIPAL' && (
          <span className="inline-block mt-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight">
            {s.vinculo}
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-zinc-400 text-xs">{s.cidade || '—'}</td>
      <td className={`px-5 py-3 text-xs font-semibold ${margemCls}`}>
        {s.margem_disponivel ?? '—'}
      </td>
      <td className="px-5 py-3">
        <button
          onClick={() => onToggleContato(s.id, !s.contatado)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
            s.contatado
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
              : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
          }`}
        >
          {s.contatado ? '✓ Contatado' : 'Marcar'}
        </button>
      </td>
    </tr>
  )
}

// ─── Grupo por órgão ─────────────────────────────────────────────────────────

const POR_PAGINA_ORGAO = 50

function GrupoOrgao({ orgao, servidores, onToggleContato }: { orgao: string; servidores: Servidor[]; onToggleContato: (id: string, valor: boolean) => void }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroMargem, setFiltroMargem] = useState<'todos' | 'com_margem' | 'sem_margem' | 'negativado'>('todos')
  const [filtroContato, setFiltroContato] = useState<'todos' | 'contatado' | 'pendente'>('todos')
  const [pagina, setPagina] = useState(1)

  const filtrados = servidores.filter(s => {
    const termo = busca.toLowerCase()
    const matchBusca = !busca || s.nome.toLowerCase().includes(termo) || s.cpf.includes(termo)
    const val = s.margem_disponivel ? parseFloat(s.margem_disponivel.replace(/[^0-9,.\-]/g, '').replace(',', '.')) : NaN
    const classMargem = isNaN(val) ? 'sem_margem' : val > 0 ? 'com_margem' : val < 0 ? 'negativado' : 'sem_margem'
    const matchMargem = filtroMargem === 'todos' || classMargem === filtroMargem
    const matchContato = filtroContato === 'todos' || (filtroContato === 'contatado' ? s.contatado : !s.contatado)
    return matchBusca && matchMargem && matchContato
  })

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA_ORGAO)
  const paginaAtual = filtrados.slice((pagina - 1) * POR_PAGINA_ORGAO, pagina * POR_PAGINA_ORGAO)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-white font-semibold text-sm">{orgao}</span>
          <span className="text-zinc-500 text-xs">{servidores.length} servidor{servidores.length !== 1 ? 'es' : ''}</span>
        </div>
        {aberto
          ? <ChevronDown className="w-4 h-4 text-zinc-500" />
          : <ChevronRight className="w-4 h-4 text-zinc-500" />
        }
      </button>

      {aberto && (
        <div className="border-t border-zinc-800">
          {/* Filtros internos */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-3 border-b border-zinc-800/60 bg-zinc-800/20">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setPagina(1) }}
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'com_margem', label: 'Com margem', cls: 'bg-emerald-600' },
                { key: 'sem_margem', label: 'Sem margem', cls: 'bg-zinc-600' },
                { key: 'negativado', label: 'Negativado', cls: 'bg-red-600' },
              ] as const).map(op => (
                <button key={op.key} onClick={() => { setFiltroMargem(op.key); setPagina(1) }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filtroMargem === op.key ? `${op.cls ?? 'bg-zinc-600'} text-white` : 'text-zinc-400 hover:text-white'}`}>
                  {op.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'pendente', label: 'Pendentes', cls: 'bg-amber-600' },
                { key: 'contatado', label: 'Contatados', cls: 'bg-violet-600' },
              ] as const).map(op => (
                <button key={op.key} onClick={() => { setFiltroContato(op.key); setPagina(1) }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filtroContato === op.key ? `${op.cls ?? 'bg-zinc-600'} text-white` : 'text-zinc-400 hover:text-white'}`}>
                  {op.label}
                </button>
              ))}
            </div>
            <span className="text-zinc-500 text-xs ml-auto">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="text-left px-5 py-3 font-medium">Nome / CPF</th>
                  <th className="text-left px-5 py-3 font-medium">Cidade</th>
                  <th className="text-left px-5 py-3 font-medium">Margem Disp.</th>
                  <th className="text-left px-5 py-3 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginaAtual.map(s => (
                  <LinhaServidor key={s.id} s={s} onToggleContato={onToggleContato} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação interna */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs">
                {(pagina - 1) * POR_PAGINA_ORGAO + 1}–{Math.min(pagina * POR_PAGINA_ORGAO, filtrados.length)} de {filtrados.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  ← Anterior
                </button>
                <span className="text-zinc-500 text-xs px-2">{pagina}/{totalPaginas}</span>
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoczalizadorPage() {
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroOrgaoGrafico, setFiltroOrgaoGrafico] = useState<string>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos')

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data, error } = await supabase
        .from('localizador_servidores')
        .select('*', { count: 'exact' })
        .order('orgao', { ascending: true })
        .order('nome', { ascending: true })
        .range(0, 9999)

      if (!error && data) setServidores(data as Servidor[])
      setLoading(false)
    }
    carregar()
  }, [])

  async function toggleContato(id: string, valor: boolean) {
    setServidores(prev => prev.map(s => s.id === id ? { ...s, contatado: valor, contatado_em: valor ? new Date().toISOString() : null } : s))
    await supabase
      .from('localizador_servidores')
      .update({ contatado: valor, contatado_em: valor ? new Date().toISOString() : null })
      .eq('id', id)
  }

  // Helper: classifica margem do servidor
  function classifMargem(s: Servidor) {
    if (!s.margem_disponivel) return 'sem_margem'
    const val = parseFloat(s.margem_disponivel.replace(/[^0-9,.\-]/g, '').replace(',', '.'))
    if (isNaN(val)) return 'sem_margem'
    if (val < 0) return 'negativado'
    if (val > 0) return 'com_margem'
    return 'sem_margem'
  }

  // Helper: filtra por período de contato
  function matchPeriodo(s: Servidor) {
    if (filtroPeriodo === 'todos') return true
    if (!s.contatado_em) return false
    const data = new Date(s.contatado_em)
    const agora = new Date()
    if (filtroPeriodo === 'hoje') {
      return data.toDateString() === agora.toDateString()
    }
    if (filtroPeriodo === 'semana') {
      const diff = (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24)
      return diff <= 7
    }
    if (filtroPeriodo === 'mes') {
      return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear()
    }
    return true
  }

  // KPIs — calculados sobre o período selecionado
  const kpis = useMemo(() => {
    const baseTotal   = servidores
    const basePeriodo = filtroPeriodo === 'todos' ? servidores : servidores.filter(s => matchPeriodo(s))
    const total       = baseTotal.length
    const contatados  = basePeriodo.filter(s => s.contatado).length
    return { total, contatados }
  }, [servidores, filtroPeriodo])



  // Agrupa por órgão
  const porOrgao = useMemo(() => {
    const mapa: Record<string, Servidor[]> = {}
    servidores.forEach(s => {
      if (!mapa[s.orgao]) mapa[s.orgao] = []
      mapa[s.orgao].push(s)
    })
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  }, [servidores])

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Localizador de Servidores" />

      <div className="p-6 space-y-6">

        {(<>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label={filtroPeriodo === 'hoje' ? 'Contatados hoje' : filtroPeriodo === 'semana' ? 'Contatados esta semana' : filtroPeriodo === 'mes' ? 'Contatados este mês' : 'Total contatados'}
            value={loading ? '—' : String(kpis.contatados)}
            sub={kpis.total > 0 ? `${Math.round(kpis.contatados / kpis.total * 100)}% do total` : undefined}
            icon={MessageCircle}
            color="#8b5cf6"
            colorClass="text-violet-400"
            bgClass="bg-violet-500/10"
          />
          <KpiCard
            label="Não contatados"
            value={loading ? '—' : String(kpis.total - kpis.contatados)}
            sub={kpis.total > 0 ? `${Math.round((kpis.total - kpis.contatados) / kpis.total * 100)}% do total` : undefined}
            icon={Users}
            color="#f59e0b"
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10"
          />
        </div>

        {/* Gráfico de pizza — distribuição de margem */}
        {!loading && servidores.length > 0 && (() => {
          const orgaos = ['todos', ...Array.from(new Set(servidores.map(s => s.orgao))).sort()]
          const base = filtroOrgaoGrafico === 'todos' ? servidores : servidores.filter(s => s.orgao === filtroOrgaoGrafico)
          const comMargem  = base.filter(s => classifMargem(s) === 'com_margem').length
          const semMargem  = base.filter(s => classifMargem(s) === 'sem_margem').length
          const negativado = base.filter(s => classifMargem(s) === 'negativado').length
          const total = base.length
          const pieData = [
            { name: 'Com margem',  value: comMargem,  color: '#10b981' },
            { name: 'Sem margem',  value: semMargem,  color: '#71717a' },
            { name: 'Negativado',  value: negativado, color: '#ef4444' },
          ].filter(d => d.value > 0)
          return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Distribuição de Margem — {total} servidores</p>
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 flex-wrap max-w-md justify-end">
                  {orgaos.map(o => (
                    <button
                      key={o}
                      onClick={() => setFiltroOrgaoGrafico(o)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${filtroOrgaoGrafico === o ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                    >
                      {o === 'todos' ? 'Todos' : o.split(' ').slice(0, 3).join(' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-48 h-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number) => [`${value} (${Math.round(value / total * 100)}%)`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                      <div>
                        <p className="text-white text-sm font-semibold">{d.value} <span className="text-zinc-500 font-normal text-xs">({Math.round(d.value / total * 100)}%)</span></p>
                        <p className="text-zinc-500 text-xs">{d.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Filtro de período */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Período de contato:</span>
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {([
              { key: 'todos',  label: 'Todos' },
              { key: 'hoje',   label: 'Hoje' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'mes',    label: 'Este mês' },
            ] as const).map(op => (
              <button
                key={op.key}
                onClick={() => setFiltroPeriodo(op.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filtroPeriodo === op.key
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
          {filtroPeriodo !== 'todos' && (
            <span className="text-emerald-400 text-xs font-semibold">
              {kpis.contatados} contatado{kpis.contatados !== 1 ? 's' : ''}
            </span>
          )}
        </div>


        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-zinc-500 text-sm">Carregando servidores...</p>
            </div>
          </div>
        ) : servidores.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm font-medium">Nenhum dado ainda</p>
            <p className="text-zinc-600 text-xs mt-1">
              Execute a automação para popular os dados dos servidores.
            </p>
          </div>
        ) : porOrgao.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-400 text-sm">Nenhum servidor encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {porOrgao.map(([orgao, lista]) => (
              <GrupoOrgao key={orgao} orgao={orgao} servidores={lista} onToggleContato={toggleContato} />
            ))}
          </div>
        )}


        </>)}

      </div>
    </div>
  )
}
