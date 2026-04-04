'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import {
  Search,
  Building2,
  Phone,
  CreditCard,
  Users,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Servidor = {
  id: string
  orgao: string
  nome: string
  cpf: string
  cidade: string
  estado: string
  tel_principal: string | null
  tel_secundario: string | null
  tel_operadora_1: string | null
  tel_operadora_2: string | null
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

// ─── Badge de status ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Servidor['status_consulta'] }) {
  const map = {
    ok:             { label: 'Encontrado',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    nao_encontrado: { label: 'Não encontrado', cls: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30' },
    erro:           { label: 'Erro',           cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  }
  const { label, cls } = map[status] ?? map.erro
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────


const MENSAGEM_WHATSAPP = (nome: string) => {
  const primeiroNome = nome.split(' ')[0]
  return encodeURIComponent(
    `Oi, ${primeiroNome}! Tudo bem?\nAqui é o Francisco, da BPX — a casa do servidor público amapaense.\n\nVi que pode ter uma oportunidade nos seus consignados de reduzir suas taxas e ainda liberar um valor extra (troco).\n\nÉ simples, rápido e sem custo e nós só ganhamos se você ganhar.\nFaz sentido continuarmos essa conversa?`
  )
}

function BotaoWhatsApp({ numero, nome }: { numero: string; nome: string }) {
  const numLimpo = numero.replace(/\D/g, '')
  const url = `https://wa.me/55${numLimpo}?text=${MENSAGEM_WHATSAPP(nome)}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
    >
      <MessageCircle className="w-3 h-3" />
      WA
    </a>
  )
}

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
      <td className="px-5 py-3">
        <p className="text-zinc-300 text-xs font-medium truncate max-w-[160px]" title={s.orgao}>
          {s.orgao
            .replace('SECRETARIA DE ESTADO DA', 'SEC.')
            .replace('SECRETARIA DE ESTADO DO', 'SEC.')
            .replace('SECRETARIA DE EST. DA', 'SEC.')
            .replace('SECRETARIA DE EST. DO', 'SEC.')
            .replace('SEC__DE_EST__DA', 'SEC.')
            .replace('DEPARTAMENTO', 'DEPTO.')
            .replace('INSTITUTO', 'INST.')
            .replace('FUNDACAO', 'FUND.')
            .replace('UNIVERSIDADE', 'UNIV.')
            .replace('PROCURADORIA GERAL DO ESTADO', 'PGE')
            .replace('POLICIA MILITAR DO ESTADO', 'PM/AP')
            .replace('CORPO DE BOMBEIROS MILITAR', 'CBM/AP')
          }
        </p>
      </td>
      <td className="px-5 py-3 text-zinc-400 text-xs">{s.cidade || '—'}</td>
      <td className="px-5 py-3">
        {s.tel_principal ? (
          <div className="space-y-1">
            <p className="text-white text-xs font-medium flex items-center gap-1">
              <Phone className="w-3 h-3 text-emerald-400" />
              {s.tel_principal}
              {s.tel_operadora_1 && (
                <span className="text-zinc-500 font-normal ml-1">{s.tel_operadora_1}</span>
              )}
              <BotaoWhatsApp numero={s.tel_principal} nome={s.nome} />
            </p>
            {s.tel_secundario && (
              <p className="text-zinc-400 text-xs flex items-center gap-1">
                <Phone className="w-3 h-3 text-zinc-600" />
                {s.tel_secundario}
                {s.tel_operadora_2 && (
                  <span className="text-zinc-500 ml-1">{s.tel_operadora_2}</span>
                )}
                <BotaoWhatsApp numero={s.tel_secundario} nome={s.nome} />
              </p>
            )}
          </div>
        ) : (
          <span className="text-zinc-600 text-xs">—</span>
        )}
      </td>
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

function GrupoOrgao({ orgao, servidores, onToggleContato }: { orgao: string; servidores: Servidor[]; onToggleContato: (id: string, valor: boolean) => void }) {
  const [aberto, setAberto] = useState(false)
  const comMargem = servidores.filter(s => s.margem_disponivel && s.status_consulta === 'ok')
  const contatados = servidores.filter(s => s.contatado)

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
        <div className="overflow-x-auto border-t border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="text-left px-5 py-3 font-medium">Nome / CPF</th>
                <th className="text-left px-5 py-3 font-medium">Órgão</th>
                <th className="text-left px-5 py-3 font-medium">Cidade</th>
                <th className="text-left px-5 py-3 font-medium">Telefones</th>
                <th className="text-left px-5 py-3 font-medium">Margem Disp.</th>
                <th className="text-left px-5 py-3 font-medium">Contato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {servidores.map(s => (
                <LinhaServidor key={s.id} s={s} onToggleContato={onToggleContato} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Novas Consignações ───────────────────────────────────────────────────────

type NovaConsignacao = {
  id: string
  nome: string
  matricula: string
  rubrica: string
  competencia: string
  prazo: string
  valor: string
  data_hora: string
  tel_principal: string | null
  tel_secundario: string | null
  tel_operadora_1: string | null
  tel_operadora_2: string | null
  margem_disponivel: string | null
  cpf: string | null
  idade: number | null
  contatado: boolean
  contatado_em: string | null
}

function NovasConsignacoes() {
  const [registros, setRegistros] = useState<NovaConsignacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroDia, setFiltroDia] = useState<'hoje' | 'ontem' | 'semana' | 'data' | 'todos'>('ontem')
  const [filtroData, setFiltroData] = useState<string>('')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('localizador_novas_consignacoes')
      .select('*')
      .order('data_hora', { ascending: false })
    if (data) setRegistros(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  async function toggleContato(id: string, valor: boolean) {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, contatado: valor, contatado_em: valor ? new Date().toISOString() : null } : r))
    await supabase.from('localizador_novas_consignacoes').update({ contatado: valor, contatado_em: valor ? new Date().toISOString() : null }).eq('id', id)
  }

  const filtrados = registros.filter(r => {
    if (filtroDia === 'todos') return true
    const data = new Date(r.data_hora)
    const agora = new Date()
    if (filtroDia === 'hoje') return data.toDateString() === agora.toDateString()
    if (filtroDia === 'ontem') {
      const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1)
      return data.toDateString() === ontem.toDateString()
    }
    if (filtroDia === 'data' && filtroData) return data.toISOString().slice(0, 10) === filtroData
    return (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) <= 7
  })

  const mensagemWA = (r: NovaConsignacao) => {
    const primeiroNome = r.nome.split(' ')[0]
    const banco = r.rubrica.split('|')[1]?.trim() || r.rubrica
    return encodeURIComponent(
      `Oi, ${primeiroNome}! Tudo bem?\nAqui é o Francisco, da BPX — a casa do servidor público amapaense.\n\nVi que pode ter uma oportunidade nos seus consignados de reduzir suas taxas e ainda liberar um valor extra (troco).\n\nÉ simples, rápido e sem custo e nós só ganhamos se você ganhar.\nFaz sentido continuarmos essa conversa?`
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-wrap">
          {([{ key: 'hoje', label: 'Hoje' }, { key: 'ontem', label: 'Ontem' }, { key: 'semana', label: 'Esta semana' }, { key: 'todos', label: 'Todos' }] as const).map(op => (
            <button key={op.key} onClick={() => setFiltroDia(op.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroDia === op.key ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
              {op.label}
            </button>
          ))}
          <button onClick={() => setFiltroDia('data')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroDia === 'data' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
            Data
          </button>
        </div>
        {filtroDia === 'data' && (
          <input
            type="date"
            value={filtroData}
            onChange={e => setFiltroData(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          />
        )}
        <button onClick={carregar} className="ml-auto flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-400 text-sm">Nenhuma consignação capturada ainda.</p>
          <p className="text-zinc-600 text-xs mt-1">A captura automática ocorre todos os dias às 19h.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="text-left px-5 py-3 font-medium">Nome</th>
                  <th className="text-left px-5 py-3 font-medium">Banco</th>
                  <th className="text-left px-5 py-3 font-medium">Valor</th>
                  <th className="text-left px-5 py-3 font-medium">Prazo</th>
                  <th className="text-left px-5 py-3 font-medium">Data</th>
                  <th className="text-left px-5 py-3 font-medium">Telefone</th>
                  <th className="text-left px-5 py-3 font-medium">Margem</th>
                  <th className="text-left px-5 py-3 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtrados.map(r => {
                  return (
                    <tr key={r.id} className={`hover:bg-zinc-800/40 transition-colors ${r.contatado ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{r.nome}</p>
                        <p className="text-zinc-500 mt-0.5">
                          {r.cpf ? r.cpf : `Mat. ${r.matricula}`}
                          {r.idade ? ` · ${r.idade} anos` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-zinc-300">{r.rubrica.split('|')[1]?.trim() || r.rubrica}</td>
                      <td className="px-5 py-3 text-emerald-400 font-semibold">{r.valor}</td>
                      <td className="px-5 py-3 text-zinc-400">{r.prazo}x</td>
                      <td className="px-5 py-3 text-zinc-500">{r.data_hora.slice(0, 16)}</td>
                      <td className="px-5 py-3">
                        {r.tel_principal ? (
                          <div className="space-y-1">
                            <p className="text-white text-xs font-medium flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                              {r.tel_principal}
                              {r.tel_operadora_1 && <span className="text-zinc-500 font-normal ml-1">{r.tel_operadora_1}</span>}
                              <a href={`https://wa.me/55${r.tel_principal.replace(/\D/g,'')}?text=${mensagemWA(r)}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-xs font-medium transition-colors">
                                <MessageCircle className="w-3 h-3" /> WA
                              </a>
                            </p>
                            {r.tel_secundario && (
                              <p className="text-zinc-400 text-xs flex items-center gap-1">
                                <Phone className="w-3 h-3 text-zinc-600 shrink-0" />
                                {r.tel_secundario}
                                {r.tel_operadora_2 && <span className="text-zinc-500 ml-1">{r.tel_operadora_2}</span>}
                                <a href={`https://wa.me/55${r.tel_secundario.replace(/\D/g,'')}?text=${mensagemWA(r)}`} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-xs font-medium transition-colors">
                                  <MessageCircle className="w-3 h-3" /> WA
                                </a>
                              </p>
                            )}
                          </div>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold text-emerald-400">
                        {r.margem_disponivel ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => toggleContato(r.id, !r.contatado)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${r.contatado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'}`}>
                          {r.contatado ? <><CheckCircle2 className="w-3 h-3" /> Contatado</> : <><Clock className="w-3 h-3" /> Marcar</>}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoczalizadorPage() {
  const [aba, setAba] = useState<'servidores' | 'novas_consignacoes'>('servidores')
  const [servidores, setServidores] = useState<Servidor[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroMargem, setFiltroMargem] = useState<'todos' | 'com_margem' | 'sem_margem' | 'negativado'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ok' | 'erro_cc'>('todos')
  const [filtroContato, setFiltroContato] = useState<'todos' | 'contatado' | 'pendente'>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 50

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

  // Filtros
  const filtrados = useMemo(() => {
    return servidores.filter(s => {
      const termoBusca = busca.toLowerCase()
      const matchBusca = !busca ||
        s.nome.toLowerCase().includes(termoBusca) ||
        s.cpf.includes(termoBusca) ||
        s.orgao.toLowerCase().includes(termoBusca)
      const matchMargem = filtroMargem === 'todos' || classifMargem(s) === filtroMargem
      const matchContato = filtroContato === 'todos' || (filtroContato === 'contatado' ? s.contatado : !s.contatado)
      const matchPer = matchPeriodo(s)
      const matchStatus = filtroStatus === 'todos' || s.status_consulta === filtroStatus
      return matchBusca && matchMargem && matchContato && matchPer && matchStatus
    })
  }, [servidores, busca, filtroMargem, filtroContato, filtroPeriodo])

  // Reset página ao mudar filtros
  useEffect(() => { setPagina(1) }, [busca, filtroMargem, filtroContato, filtroPeriodo, filtroStatus])

  // Paginação
  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const filtradosPagina = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  // Agrupa por órgão em TODOS os filtrados (não só da página atual)
  const porOrgao = useMemo(() => {
    const mapa: Record<string, Servidor[]> = {}
    filtrados.forEach(s => {
      if (!mapa[s.orgao]) mapa[s.orgao] = []
      mapa[s.orgao].push(s)
    })
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  }, [filtrados])

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Localizador de Servidores" />

      <div className="p-6 space-y-6">

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
          {([
            { key: 'servidores',          label: 'Servidores' },
            { key: 'novas_consignacoes',   label: 'Últimas Consignações' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setAba(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                aba === tab.key ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {aba === 'novas_consignacoes' && <NovasConsignacoes />}

        {aba === 'servidores' && (<>

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
          const comMargem  = servidores.filter(s => classifMargem(s) === 'com_margem').length
          const semMargem  = servidores.filter(s => classifMargem(s) === 'sem_margem').length
          const negativado = servidores.filter(s => classifMargem(s) === 'negativado').length
          const total = servidores.length
          const pieData = [
            { name: 'Com margem',  value: comMargem,  color: '#10b981' },
            { name: 'Sem margem',  value: semMargem,  color: '#71717a' },
            { name: 'Negativado',  value: negativado, color: '#ef4444' },
          ].filter(d => d.value > 0)
          return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-4">Distribuição de Margem — {total} servidores</p>
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

        {/* Filtros */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou órgão..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder:text-zinc-600 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            {/* Filtro de margem */}
            <div className="flex flex-col gap-1">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-medium">Margem</p>
              <div className="flex items-center gap-1 bg-zinc-800/60 border border-zinc-700 rounded-lg p-1">
                {([
                  { key: 'todos',      label: 'Todos' },
                  { key: 'com_margem', label: 'Com margem', activeClass: 'bg-emerald-600' },
                  { key: 'sem_margem', label: 'Sem margem', activeClass: 'bg-zinc-600' },
                  { key: 'negativado', label: 'Negativado',  activeClass: 'bg-red-600' },
                ] as const).map(op => (
                  <button
                    key={op.key}
                    onClick={() => setFiltroMargem(op.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filtroMargem === op.key
                        ? `${op.activeClass ?? 'bg-zinc-600'} text-white shadow`
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divisor */}
            <div className="w-px h-8 bg-zinc-700 hidden sm:block" />

            {/* Filtro de contato */}
            <div className="flex flex-col gap-1">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-medium">Contato</p>
              <div className="flex items-center gap-1 bg-zinc-800/60 border border-zinc-700 rounded-lg p-1">
                {([
                  { key: 'todos',     label: 'Todos' },
                  { key: 'pendente',  label: 'Pendentes',  activeClass: 'bg-amber-600' },
                  { key: 'contatado', label: 'Contatados', activeClass: 'bg-violet-600' },
                ] as const).map(op => (
                  <button
                    key={op.key}
                    onClick={() => setFiltroContato(op.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      filtroContato === op.key
                        ? `${op.activeClass ?? 'bg-zinc-600'} text-white shadow`
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>


            <p className="text-zinc-500 text-xs ml-auto">
              {filtrados.length} servidor{filtrados.length !== 1 ? 'es' : ''}
            </p>
          </div>
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
            <p className="text-zinc-400 text-sm">Nenhum resultado para &quot;{busca}&quot;</p>
          </div>
        ) : (
          <div className="space-y-4">
            {porOrgao.map(([orgao, lista]) => (
              <GrupoOrgao key={orgao} orgao={orgao} servidores={lista} onToggleContato={toggleContato} />
            ))}
          </div>
        )}

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3">
            <p className="text-zinc-500 text-xs">
              {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length} servidores
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPagina(p => Math.max(1, p - 1)); window.scrollTo(0, 0) }}
                disabled={pagina === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i-1] === 'number' && (p as number) - (arr[i-1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) => p === '...' ? (
                  <span key={`e${i}`} className="px-2 text-zinc-600 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => { setPagina(p as number); window.scrollTo(0, 0) }}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pagina === p ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  >
                    {p}
                  </button>
                ))
              }
              <button
                onClick={() => { setPagina(p => Math.min(totalPaginas, p + 1)); window.scrollTo(0, 0) }}
                disabled={pagina === totalPaginas}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}

        </>)}

      </div>
    </div>
  )
}
