'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { MessageCircle, RefreshCw, CheckCircle2, Clock, Phone } from 'lucide-react'

type NovaConsignacao = {
  id: string
  nome: string
  matricula: string
  rubrica: string
  competencia: string
  prazo: string
  valor: string
  data_hora: string
  capturado_em: string
  contatado: boolean
  contatado_em: string | null
  // campos enriquecidos de localizador_servidores
  cpf: string | null
  tel_principal: string | null
  tel_secundario: string | null
  tel_operadora_1: string | null
  tel_operadora_2: string | null
  margem_disponivel: string | null
  idade: number | null
}

const MENSAGEM_WHATSAPP = (nome: string, valor: string, rubrica: string) => {
  const primeiroNome = nome.split(' ')[0]
  const banco = rubrica.split('|')[1]?.trim() || rubrica
  return encodeURIComponent(
    `Oi, ${primeiroNome}! Tudo bem?\nAqui é o Francisco, da BPX — a casa do servidor público amapaense.\n\nVi que você acabou de contratar um consignado no ${banco} no valor de ${valor}.\n\nPosso te mostrar como reduzir essa parcela ou liberar um valor extra sem custo.\nNós só ganhamos se você ganhar.\n\nFaz sentido conversarmos?`
  )
}

function BotaoWhatsApp({ numero, nome, valor, rubrica }: { numero: string; nome: string; valor: string; rubrica: string }) {
  const numLimpo = numero.replace(/\D/g, '')
  const url = `https://wa.me/55${numLimpo}?text=${MENSAGEM_WHATSAPP(nome, valor, rubrica)}`
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

export default function NovasConsignacoesPage() {
  const [registros, setRegistros] = useState<NovaConsignacao[]>([])
  const [loading, setLoading] = useState(true)
  const [enriquecendo, setEnriquecendo] = useState(false)
  const [filtroDia, setFiltroDia] = useState<'hoje' | 'semana' | 'todos'>('hoje')

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('localizador_novas_consignacoes')
      .select('*')
      .order('data_hora', { ascending: false })
    if (data) {
      setRegistros(data)
      enriquecerRegistros(data)
    }
    setLoading(false)
  }

  async function enriquecerRegistros(lista: NovaConsignacao[]) {
    const semDados = lista.filter(r => !r.cpf && !r.tel_principal)
    if (semDados.length === 0) return

    setEnriquecendo(true)

    // 1. Tenta preencher via localizador_servidores (já no banco)
    const aindaSemDados: NovaConsignacao[] = []
    for (const r of semDados) {
      const partes = r.nome.trim().split(' ')
      const primeiro = partes[0]
      const ultimo = partes[partes.length - 1]

      const { data: servidor } = await supabase
        .from('localizador_servidores')
        .select('cpf, tel_principal, tel_secundario, tel_operadora_1, tel_operadora_2, margem_disponivel, idade')
        .ilike('nome', `%${primeiro}%${ultimo}%`)
        .eq('status_consulta', 'ok')
        .limit(1)
        .single()

      if (servidor) {
        const update = {
          cpf: servidor.cpf ?? null,
          tel_principal: servidor.tel_principal ?? null,
          tel_secundario: servidor.tel_secundario ?? null,
          tel_operadora_1: servidor.tel_operadora_1 ?? null,
          tel_operadora_2: servidor.tel_operadora_2 ?? null,
          margem_disponivel: servidor.margem_disponivel ?? null,
          idade: servidor.idade ?? null,
        }
        await supabase.from('localizador_novas_consignacoes').update(update).eq('id', r.id)
        setRegistros(prev => prev.map(x => x.id === r.id ? { ...x, ...update } : x))
      } else {
        aindaSemDados.push(r)
      }
    }

    // 2. Quem não está no banco: envia ao servidor local (Playwright → ConsultCenter + APConsig)
    if (aindaSemDados.length > 0) {
      try {
        const nomes = aindaSemDados.map(r => r.nome)
        await fetch('http://localhost:3001/enriquecer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomes }),
        })
        // Servidor processa em background; recarrega após 90s para pegar os dados novos
        setTimeout(() => carregar(), 90000)
      } catch {
        // Servidor local não está rodando — ignora silenciosamente
      }
    }

    setEnriquecendo(false)
  }

  useEffect(() => { carregar() }, [])

  async function toggleContato(id: string, valor: boolean) {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, contatado: valor, contatado_em: valor ? new Date().toISOString() : null } : r))
    await supabase
      .from('localizador_novas_consignacoes')
      .update({ contatado: valor, contatado_em: valor ? new Date().toISOString() : null })
      .eq('id', id)
  }

  const filtrados = useMemo(() => {
    return registros.filter(r => {
      if (filtroDia === 'todos') return true
      const data = new Date(r.data_hora)
      const agora = new Date()
      if (filtroDia === 'hoje') return data.toDateString() === agora.toDateString()
      if (filtroDia === 'semana') return (agora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24) <= 7
      return true
    })
  }, [registros, filtroDia])

  const pendentes = filtrados.filter(r => !r.contatado).length
  const contatados = filtrados.filter(r => r.contatado).length
  const comTel = filtrados.filter(r => r.tel_principal).length
  const comMargem = filtrados.filter(r => r.margem_disponivel).length

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header title="Últimas Consignações" />

      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#f59e0b' }}>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Pendentes</p>
            <p className="text-white font-bold text-2xl">{loading ? '—' : pendentes}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#8b5cf6' }}>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Contatados</p>
            <p className="text-white font-bold text-2xl">{loading ? '—' : contatados}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#10b981' }}>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Com Telefone</p>
            <p className="text-white font-bold text-2xl">{loading ? '—' : comTel}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 border-t-2 rounded-xl p-5" style={{ borderTopColor: '#3b82f6' }}>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Com Margem</p>
            <p className="text-white font-bold text-2xl">{loading ? '—' : comMargem}</p>
          </div>
        </div>

        {/* Filtros + Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {([
              { key: 'hoje',   label: 'Hoje' },
              { key: 'semana', label: 'Esta semana' },
              { key: 'todos',  label: 'Todos' },
            ] as const).map(op => (
              <button
                key={op.key}
                onClick={() => setFiltroDia(op.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filtroDia === op.key ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
          <button
            onClick={carregar}
            className="ml-auto flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${enriquecendo ? 'animate-spin text-emerald-400' : ''}`} />
            {enriquecendo ? 'Buscando dados...' : 'Atualizar'}
          </button>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-400 text-sm">Nenhuma nova consignação capturada ainda.</p>
            <p className="text-zinc-600 text-xs mt-1">A captura automática ocorre todos os dias às 19h.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-5 py-3 font-medium">Nome / CPF</th>
                    <th className="text-left px-4 py-3 font-medium">Banco</th>
                    <th className="text-left px-4 py-3 font-medium">Valor</th>
                    <th className="text-left px-4 py-3 font-medium">Prazo</th>
                    <th className="text-left px-4 py-3 font-medium">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium">Margem</th>
                    <th className="text-left px-4 py-3 font-medium">Data</th>
                    <th className="text-left px-5 py-3 font-medium">Contato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filtrados.map(r => {
                    const margemNum = parseFloat((r.margem_disponivel ?? '').replace(/[^0-9,\-]/g, '').replace(',', '.'))
                    const margemCls = isNaN(margemNum) ? 'text-zinc-500' : margemNum > 0 ? 'text-emerald-400' : 'text-red-400'
                    return (
                      <tr key={r.id} className={`hover:bg-zinc-800/40 transition-colors ${r.contatado ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3">
                          <p className="text-white font-medium">{r.nome}</p>
                          <p className="text-zinc-500 mt-0.5">Mat. {r.matricula}</p>
                          {r.cpf && <p className="text-zinc-600 mt-0.5">{r.cpf}</p>}
                          {r.idade && <p className="text-zinc-600 mt-0.5">{r.idade} anos</p>}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{r.rubrica.split('|')[1]?.trim() || r.rubrica}</td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold">{r.valor}</td>
                        <td className="px-4 py-3 text-zinc-400">{r.prazo}x</td>
                        <td className="px-4 py-3">
                          {r.tel_principal ? (
                            <div className="space-y-1">
                              <p className="text-white font-medium flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                {r.tel_principal}
                                {r.tel_operadora_1 && <span className="text-zinc-500 font-normal ml-1">{r.tel_operadora_1}</span>}
                                <BotaoWhatsApp numero={r.tel_principal} nome={r.nome} valor={r.valor} rubrica={r.rubrica} />
                              </p>
                              {r.tel_secundario && (
                                <p className="text-zinc-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-zinc-600 shrink-0" />
                                  {r.tel_secundario}
                                  {r.tel_operadora_2 && <span className="text-zinc-500 ml-1">{r.tel_operadora_2}</span>}
                                  <BotaoWhatsApp numero={r.tel_secundario} nome={r.nome} valor={r.valor} rubrica={r.rubrica} />
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${margemCls}`}>
                          {r.margem_disponivel ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{r.data_hora.slice(0, 16).replace('T', ' ')}</td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => toggleContato(r.id, !r.contatado)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                              r.contatado
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                            }`}
                          >
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
    </div>
  )
}
