export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  )
}

async function enviarWhatsapp(phone: string, mensagem: string) {
  const instance    = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  if (!instance || !token || !phone) throw new Error('Z-API não configurada')

  const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientToken ? { 'Client-Token': clientToken } : {}),
    },
    body: JSON.stringify({ phone, message: mensagem }),
  })
  if (!res.ok) throw new Error(`Z-API erro: ${res.status} ${await res.text()}`)
  return res.json()
}

function getMesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmt(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function distribuicaoLucro(lucro: number) {
  return [
    { nome: 'Francisco', percentual: 43.5, valor: lucro * 0.435 },
    { nome: 'Renan',     percentual: 43.5, valor: lucro * 0.435 },
    { nome: 'Felipe',    percentual: 5,    valor: lucro * 0.05  },
    { nome: 'Marcelo',   percentual: 4,    valor: lucro * 0.04  },
    { nome: 'Ingrid',    percentual: 4,    valor: lucro * 0.04  },
  ]
}

// ─── Relatório de Visão Geral (Jarvis) ───────────────────────────────────────
async function gerarRelatorioGeral() {
  const supabase = getSupabase()
  const mes = getMesAtual()
  const hoje = new Date()
  const dataFormatada = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  // Contratos do mês
  const { data: contratos } = await supabase
    .from('contratos')
    .select('status, taxa, created_at, data_finalizacao')

  const contratosDoMes = (contratos ?? []).filter(c => {
    const ref = c.data_finalizacao || c.created_at
    return ref?.slice(0, 7) === mes
  })

  const finalizados  = contratosDoMes.filter(c => c.status === 'finalizado')
  // "aguardando" = aguardando liberação de margem = em andamento no pipeline
  const aguardando   = (contratos ?? []).filter(c => c.status === 'aguardando')
  const receita      = finalizados.reduce((s, c) => s + Number(c.taxa), 0)
  const potencialPipeline = aguardando.reduce((s, c) => s + Number(c.taxa), 0)

  // Despesas do mês (operacionais)
  const { data: despesas } = await supabase
    .from('despesas')
    .select('valor, categoria, mes')
    .eq('mes', mes)

  const despesasOp = (despesas ?? [])
    .filter(d => !['compra_divida', 'pl', 'devolucao_emprestimo', 'bonificacao'].includes(d.categoria))
    .reduce((s, d) => s + Number(d.valor), 0)

  // Folha prevista do mês
  const { data: folhaData } = await supabase
    .from('previsao_folha')
    .select('valor')
    .eq('mes', mes)
    .single()
  const folha = Number(folhaData?.valor ?? 0)

  // Comissões do mês (calculadas a partir das metas)
  const { data: metas } = await supabase
    .from('metas_vendedor')
    .select('vendedor, meta_receita, assistente, analista')
    .eq('mes', mes)

  let comissoes = 0
  if (metas && contratos) {
    for (const m of metas) {
      const contratosVendedor = finalizados.filter(c =>
        (c as any).vendedor === m.vendedor ||
        (c as any).assistente === m.vendedor ||
        (c as any).analista === m.vendedor
      )
      const receitaVendedor = contratosVendedor.reduce((s, c) => s + Number(c.taxa), 0)
      const pct = m.meta_receita > 0 ? (receitaVendedor / m.meta_receita) * 100 : 0
      let percComissao = 0
      if (pct >= 150) percComissao = 5
      else if (pct >= 131) percComissao = 4
      else if (pct >= 91)  percComissao = 3
      else if (pct >= 81)  percComissao = 2
      else if (pct >= 71)  percComissao = 1.5
      const soloOuDupla = m.assistente && m.analista ? 0.5 : 1
      comissoes += receitaVendedor * (percComissao / 100) * soloOuDupla
    }
  }

  const totalDespesas = despesasOp + folha + comissoes
  const lucro = receita - totalDespesas
  const margem = receita > 0 ? (lucro / receita) * 100 : 0

  const dist = distribuicaoLucro(lucro)

  const saudacao = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  function gerarCabecalho(nome: string) {
    return `${saudacao}, ${nome}! 👋 Aqui é o Jarvis, assistente pessoal do Renan.\n\nTrago o relatório de visão geral da BPX pra você começar o dia bem informado.`
  }

  const distLinhas = dist.map(d =>
    `   • ${d.nome}: R$ ${fmt(d.valor)} (${d.percentual}%)`
  ).join('\n')

  // Ritmo e projeção de receita
  const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const diaAtual = hoje.getDate()
  const expectedPct = diaAtual / daysInMonth
  const metaTotal = (metas ?? []).reduce((s, m) => s + Number(m.meta_receita ?? 0), 0)
  const receitaEsperada = metaTotal * expectedPct
  const projecaoFinal = expectedPct > 0 ? (receita / expectedPct) : 0
  const diffRitmo = receita - receitaEsperada

  // Insights
  const insights: string[] = []

  // Ritmo de receita
  if (metaTotal > 0 && diaAtual > 3) {
    if (diffRitmo < 0) {
      insights.push(`📉 Ritmo abaixo: faltam R$ ${fmt(Math.abs(diffRitmo))} para estar no ritmo esperado`)
    } else {
      insights.push(`📈 Ritmo acima: R$ ${fmt(diffRitmo)} à frente do esperado para o período`)
    }
  }

  // Projeção de fechamento
  if (metaTotal > 0 && diaAtual > 3 && projecaoFinal > 0) {
    const diffProjecao = projecaoFinal - metaTotal
    if (diffProjecao >= 0) {
      insights.push(`🎯 Projeção de fechamento: R$ ${fmt(projecaoFinal)} — ${fmt(diffProjecao)} acima da meta`)
    } else {
      insights.push(`🎯 Projeção de fechamento: R$ ${fmt(projecaoFinal)} — R$ ${fmt(Math.abs(diffProjecao))} abaixo da meta`)
    }
  }

  // Contratos aguardando liberação de margem
  if (aguardando.length > 0 && potencialPipeline > 0) {
    insights.push(`⏳ ${aguardando.length} contrato(s) aguardando margem — liberar pode trazer R$ ${fmt(potencialPipeline)} de receita adicional`)
  }

  const insightsTexto = insights.map(i => `• ${i}`).join('\n')
  const statusEmoji = lucro >= 0 ? '🟢' : '🔴'
  const lucroTexto = lucro >= 0
    ? `R$ ${fmt(lucro)} de lucro estimado`
    : `Prejuízo estimado de R$ ${fmt(Math.abs(lucro))} 😬`

  function buildMsg(nome: string) {
    return `${saudacao}, ${nome}! 👋
Aqui é o *Jarvis*, assistente pessoal do Renan. Vou te deixar por dentro de como a BPX está hoje.

━━━━━━━━━━━━━━━━━
📋 *CONTRATOS DO MÊS*
• ✅ Finalizados: ${finalizados.length} → R$ ${fmt(receita)}
• ⏳ Ag. liberação de margem: ${aguardando.length}${potencialPipeline > 0 ? ` → R$ ${fmt(potencialPipeline)} em aberto` : ''}${potencialPipeline > 0 ? `\n• 💡 Fechando o pipeline: receita pode chegar a R$ ${fmt(receita + potencialPipeline)}` : ''}

━━━━━━━━━━━━━━━━━
💰 *FINANCEIRO*
• Receita: R$ ${fmt(receita)}
• Despesas: R$ ${fmt(despesasOp)}
• Folha + Comissões: R$ ${fmt(folha + comissoes)}
• *${lucroTexto}*

━━━━━━━━━━━━━━━━━
${statusEmoji} *DISTRIBUIÇÃO DO LUCRO*
${distLinhas}

━━━━━━━━━━━━━━━━━
🧠 *DIAGNÓSTICO*
${insightsTexto}

━━━━━━━━━━━━━━━━━
_${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · Qualquer coisa estou por aqui! 😄_`
  }

  return { renan: buildMsg('Renan'), francisco: buildMsg('Francisco') }
}

// ─── Alertas operacionais ─────────────────────────────────────────────────────
async function gerarAlertas(): Promise<string[]> {
  const supabase = getSupabase()
  const mes = getMesAtual()
  const hoje = new Date().toISOString().slice(0, 10)
  const alertas: string[] = []

  const { data: contratos } = await supabase
    .from('contratos')
    .select('nome, created_at, status')
    .eq('status', 'aguardando')
  if (contratos) {
    const atrasados = contratos.filter(c => {
      const dias = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
      return dias > 7
    })
    if (atrasados.length > 0)
      alertas.push(`📋 ${atrasados.length} contrato(s) aguardando há mais de 7 dias`)
  }

  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = amanha.toISOString().slice(0, 10)
  const { data: contas } = await supabase
    .from('contas_pagar')
    .select('descricao, valor, data_vencimento, status')
    .neq('status', 'pago')
    .lte('data_vencimento', amanhaStr)
  if (contas && contas.length > 0) {
    const vencidas    = contas.filter(c => c.data_vencimento < hoje)
    const venceHoje   = contas.filter(c => c.data_vencimento === hoje)
    const venceAmanha = contas.filter(c => c.data_vencimento === amanhaStr)
    const totalVal    = contas.reduce((s, c) => s + Number(c.valor), 0)
    if (vencidas.length > 0)
      alertas.push(`🔴 ${vencidas.length} conta(s) VENCIDA(S) não paga(s)`)
    if (venceHoje.length > 0)
      alertas.push(`⚠️ ${venceHoje.length} conta(s) vence(m) HOJE`)
    if (venceAmanha.length > 0)
      alertas.push(`📅 ${venceAmanha.length} conta(s) vence(m) amanhã`)
    alertas.push(`💸 Total pendente: R$ ${fmt(totalVal)}`)
  }

  const { data: contratosDoMes } = await supabase
    .from('contratos')
    .select('taxa, status, created_at, data_finalizacao')
  const { data: despesasDoMes } = await supabase
    .from('despesas')
    .select('valor, categoria, mes')
    .eq('mes', mes)

  if (contratosDoMes && despesasDoMes) {
    const receita = contratosDoMes
      .filter(c => c.status === 'finalizado' && (c.data_finalizacao || c.created_at)?.slice(0, 7) === mes)
      .reduce((s, c) => s + Number(c.taxa), 0)
    const despesas = despesasDoMes
      .filter(d => !['compra_divida', 'pl', 'devolucao_emprestimo', 'bonificacao'].includes(d.categoria))
      .reduce((s, d) => s + Number(d.valor), 0)
    if (receita > 0) {
      const margem = ((receita - despesas) / receita) * 100
      if (margem < 20)
        alertas.push(`📉 Margem do mês em ${margem.toFixed(1)}% — abaixo de 20%`)
      if (receita - despesas < 0)
        alertas.push(`🔴 Mês NO VERMELHO: prejuízo de R$ ${fmt(Math.abs(receita - despesas))}`)
    }
  }

  const { data: consultores } = await supabase
    .from('metas_vendedor')
    .select('vendedor')
    .eq('mes', mes)
  if (!consultores || consultores.length === 0)
    alertas.push(`🎯 Nenhuma meta cadastrada para este mês`)

  const { data: saldos } = await supabase
    .from('fluxo_caixa_saldos')
    .select('data, saldo_calculado, saldo_real')
    .gte('data', `${mes}-01`)
    .lte('data', `${mes}-31`)
  if (saldos) {
    const divergencias = saldos.filter(s =>
      s.saldo_real != null && Math.abs(Number(s.saldo_calculado) - Number(s.saldo_real)) > 0.01
    )
    if (divergencias.length > 0)
      alertas.push(`⚠️ ${divergencias.length} divergência(s) no fluxo de caixa`)
  }

  return alertas
}

// ─── Insights por Consultor ───────────────────────────────────────────────────
async function gerarInsightConsultor(
  nome: string,
  dados: { leads: number; won: number; revenue: number; leadsHoje: number; conversao: number; ticket: number },
  meta: { meta_receita: number; meta_leads: number; meta_conversao: number; meta_ticket: number } | null,
  expectedPct: number,
) {
  const insights: string[] = []

  const pctMeta  = meta && meta.meta_receita > 0 ? (dados.revenue / meta.meta_receita) * 100 : null
  const pctLeads = meta && meta.meta_leads > 0 ? (dados.leads / meta.meta_leads) * 100 : null

  // Ritmo de receita
  if (pctMeta !== null && expectedPct > 20) {
    if (pctMeta < expectedPct * 0.6) {
      insights.push(`🔴 Ritmo de receita muito abaixo (${pctMeta.toFixed(0)}% da meta, esperado ${expectedPct.toFixed(0)}%) — risco alto de não bater o mês`)
    } else if (pctMeta >= 100) {
      insights.push(`🎉 Meta de receita batida! (${pctMeta.toFixed(0)}%) — cada novo contrato agora é bônus`)
    } else if (pctMeta >= expectedPct) {
      insights.push(`✅ No ritmo certo de receita (${pctMeta.toFixed(0)}% da meta) — manter o ritmo até o fim do mês`)
    } else {
      insights.push(`⚠️ Receita em ${pctMeta.toFixed(0)}% da meta (esperado ${expectedPct.toFixed(0)}%) — precisa acelerar`)
    }
  }

  // Prospecção / leads
  if (pctLeads !== null && expectedPct > 20) {
    if (pctLeads < 60) {
      insights.push(`🔴 Prospecção abaixo do ritmo (${pctLeads.toFixed(0)}% da meta de leads) — isso explica dificuldade de bater receita. Aumentar captação diária`)
    } else if (pctLeads >= 100) {
      insights.push(`✅ Meta de prospecção batida (${pctLeads.toFixed(0)}%) — volume de leads saudável`)
    }
  }

  // Conversão vs prospecção — diagnóstico cruzado
  if (meta && meta.meta_conversao > 0 && dados.leads >= 5) {
    if (dados.conversao < meta.meta_conversao * 0.7) {
      if (pctLeads !== null && pctLeads >= 85) {
        insights.push(`⚠️ Você prospecta bem, mas a conversão está baixa (${dados.conversao.toFixed(1)}% vs meta ${meta.meta_conversao}%) — revisar discurso de fechamento e qualificação dos leads`)
      } else {
        insights.push(`⚠️ Conversão abaixo da meta (${dados.conversao.toFixed(1)}% vs ${meta.meta_conversao}%) — avaliar qualidade dos leads e abordagem`)
      }
    } else if (dados.conversao >= meta.meta_conversao) {
      insights.push(`✅ Boa conversão (${dados.conversao.toFixed(1)}%) — fechamento eficiente`)
    }
  } else if (dados.leads >= 5 && dados.conversao < 15) {
    insights.push(`⚠️ Conversão abaixo de 15% (${dados.conversao.toFixed(1)}%) — vale analisar qualidade dos leads e abordagem`)
  }

  // Ticket médio
  if (meta && meta.meta_ticket > 0 && dados.ticket > 0 && dados.ticket < meta.meta_ticket * 0.8) {
    insights.push(`📉 Ticket médio abaixo da meta (R$ ${dados.ticket.toFixed(0)} vs R$ ${meta.meta_ticket}) — focar em contratos de maior valor`)
  }

  // Leads hoje
  if (dados.leadsHoje === 0) {
    insights.push(`📵 Nenhum lead captado hoje ainda — meta diária de prospecção em aberto`)
  } else {
    insights.push(`📲 ${dados.leadsHoje} lead(s) captado(s) hoje — bom começo de dia`)
  }

  // Sem dados
  if (dados.leads === 0) {
    insights.push(`❓ Nenhum lead registrado no mês — verificar integração com CRM`)
  }

  const primeiroNome = nome.split(' ')[0]
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return `🤖 *Jarvis aqui, ${primeiroNome}!*
_Seus números de hoje · ${hoje}_

━━━━━━━━━━━━━━━━━
📊 *SEUS DADOS DO MÊS*
• Receita: R$ ${fmt(dados.revenue)}${meta && meta.meta_receita > 0 ? ` / meta R$ ${fmt(meta.meta_receita)} (${pctMeta?.toFixed(0)}%)` : ''}
• Contratos fechados: ${dados.won}
• Leads captados: ${dados.leads}${meta && meta.meta_leads > 0 ? ` / meta ${meta.meta_leads}` : ''}
• Conversão: ${dados.conversao.toFixed(1)}%
• Ticket médio: R$ ${fmt(dados.ticket)}

━━━━━━━━━━━━━━━━━
🧠 *DIAGNÓSTICO*
${insights.slice(0, 4).join('\n\n')}

━━━━━━━━━━━━━━━━━
_Bora! O dia ainda é longo. 💪_`
}

async function enviarInsightsConsultores() {
  const supabase = getSupabase()
  const mes = getMesAtual()

  const hoje = new Date()
  const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const expectedPct = Math.min((hoje.getDate() / daysInMonth) * 100, 100)

  const inicio = `${mes}-01`
  const fim = hoje.toISOString().slice(0, 10)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard-novo-chi.vercel.app'
  const clintRes = await fetch(`${baseUrl}/api/clint?start=${inicio}&end=${fim}`)
  const clintData = clintRes.ok ? await clintRes.json() : null

  const { data: metas } = await supabase
    .from('metas_vendedor')
    .select('vendedor, meta_receita, meta_leads, meta_conversao, meta_ticket')
    .eq('mes', mes)

  const vendedores: any[] = clintData?.consultores ?? []
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const hojeLabel = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  const saudacaoGerente = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  const META_LEADS_DIA = 10
  const diasUteisPorMes = 22
  const diaAtualMes = hoje.getDate()
  // Estimativa de dias úteis decorridos (aprox. 5/7 dos dias corridos)
  const diasUteisDecorridos = Math.round(diaAtualMes * (5 / 7))
  const leadsDiariosEsperados = META_LEADS_DIA * diasUteisDecorridos

  function buildMsgGerente(nomeGerente: string) {
    let msg = `${saudacaoGerente}, ${nomeGerente}! 👋\nAqui é o *Jarvis*, assistente pessoal do Renan. Aqui está o raio-x da equipe pra você trabalhar hoje.\n`

    for (const v of vendedores) {
      const meta = metas?.find(m => v.nome.toLowerCase().includes(m.vendedor.toLowerCase())) ?? null
      const pctMeta  = meta && meta.meta_receita > 0 ? (v.receita / meta.meta_receita) * 100 : null

      // Prospecção: meta de 10 leads/dia × dias úteis decorridos
      const leadsEsperados = leadsDiariosEsperados
      const saldoLeads = v.leads - leadsEsperados
      const leadsFaltamHoje = Math.max(META_LEADS_DIA - v.leadsHoje, 0)

      // Conversão
      const metaConversao = meta?.meta_conversao ?? 0
      const conversaoOk = metaConversao > 0 ? v.taxaConversao >= metaConversao : v.taxaConversao >= 20

      let status = '🟡'
      if (pctMeta !== null) {
        if (pctMeta >= 100) status = '🟢'
        else if (pctMeta < expectedPct * 0.6) status = '🔴'
      }

      const primeiroNome = v.nome.split(' ')[0]
      msg += `\n━━━━━━━━━━━━━━━━━\n`
      msg += `${status} *${primeiroNome}*\n`
      msg += `• Receita: R$ ${fmt(v.receita)}${pctMeta !== null ? ` (${pctMeta.toFixed(0)}% da meta)` : ''}\n`
      msg += `• Contratos fechados: ${v.deals}\n`

      // Prospecção detalhada
      msg += `\n📲 *Prospecção*\n`
      msg += `• Leads no mês: ${v.leads} ${saldoLeads >= 0 ? `✅ (+${saldoLeads} acima do ritmo)` : `⚠️ (${Math.abs(saldoLeads)} abaixo do ritmo)`}\n`
      msg += `• Leads hoje: ${v.leadsHoje}/${META_LEADS_DIA} — ${v.leadsHoje >= META_LEADS_DIA ? '✅ meta do dia batida!' : `faltam ${leadsFaltamHoje} pra fechar o dia`}\n`

      // Conversão detalhada
      msg += `\n🎯 *Conversão*\n`
      msg += `• Taxa atual: ${v.taxaConversao.toFixed(1)}%${metaConversao > 0 ? ` (meta: ${metaConversao}%)` : ''} ${conversaoOk ? '✅' : '⚠️'}\n`

      // Insights práticos para o dia
      const insights: string[] = []

      if (v.leadsHoje === 0)
        insights.push(`📵 Nenhum lead captado ainda — prioridade número 1 hoje`)
      else if (v.leadsHoje < META_LEADS_DIA)
        insights.push(`📲 Ainda faltam ${leadsFaltamHoje} leads pra bater a meta diária`)

      if (saldoLeads < 0 && Math.abs(saldoLeads) > META_LEADS_DIA * 2)
        insights.push(`📉 Prospecção muito atrasada — precisa de um esforço extra nos próximos dias`)

      if (!conversaoOk && v.leads >= 5) {
        if (saldoLeads >= 0)
          insights.push(`🔄 Prospecção em dia mas conversão baixa — foco na qualificação dos leads e no fechamento`)
        else
          insights.push(`⚠️ Conversão e prospecção abaixo — trabalhar qualidade e volume ao mesmo tempo`)
      } else if (conversaoOk && saldoLeads < 0) {
        insights.push(`💡 Boa conversão, mas poucos leads — aumentar volume vai multiplicar os resultados`)
      } else if (conversaoOk && saldoLeads >= 0 && (pctMeta ?? 0) >= expectedPct * 100) {
        insights.push(`🔥 Tudo no ritmo — manter a pressão e fechar o mês forte`)
      }

      if (pctMeta !== null && pctMeta < expectedPct * 0.6)
        insights.push(`🚨 Ritmo de receita crítico — priorizar leads quentes e contratos em negociação`)

      if (insights.length > 0) {
        msg += `\n💬 *Foco de hoje*\n`
        insights.forEach(i => msg += `• ${i}\n`)
      }
    }

    msg += `\n━━━━━━━━━━━━━━━━━\n_Bora fazer acontecer! Qualquer dúvida estou aqui. 💪_`
    return msg
  }

  // ── Mensagem detalhada para gerentes (Marcelo e Ingrid) ──
  let msgGerentes = '' // não usado mais diretamente

  await Promise.all([
    enviarWhatsapp('5596992052874', buildMsgGerente('Marcelo')),
    enviarWhatsapp('5596999679914', buildMsgGerente('Ingrid')),
  ])

  // ── Resumo compacto para Renan ──
  const saudacaoRenan = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  let msgRenan = `${saudacaoRenan}, Renan! 👋\nAqui é o *Jarvis*. Visão gerencial da equipe pra você.\n`

  for (const v of vendedores) {
    const meta = metas?.find(m => v.nome.toLowerCase().includes(m.vendedor.toLowerCase())) ?? null
    const pctMeta = meta && meta.meta_receita > 0 ? (v.receita / meta.meta_receita) * 100 : null

    let status = '🟡'
    if (pctMeta !== null) {
      if (pctMeta >= 100) status = '🟢'
      else if (pctMeta < expectedPct * 0.6) status = '🔴'
    }

    const primeiroNome = v.nome.split(' ')[0]
    msgRenan += `\n${status} *${primeiroNome}* — R$ ${fmt(v.receita)}`
    if (pctMeta !== null) msgRenan += ` (${pctMeta.toFixed(0)}%)`
    msgRenan += ` · ${v.leads} leads · conv ${v.taxaConversao.toFixed(1)}%\n`
  }

  msgRenan += `\n━━━━━━━━━━━━━━━━━\n_Bora! 🚀_`
  await enviarWhatsapp('5596981405293', msgRenan)
}

// ─── Resumo Semanal (Jarvis) ──────────────────────────────────────────────────
async function gerarResumoSemanal() {
  const supabase = getSupabase()
  const mes = getMesAtual()
  const hoje = new Date()

  // Semana atual: segunda a hoje (sábado)
  const diaSemana = hoje.getDay() // 6 = sábado
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
  const fimSemana = hoje

  // Semana anterior
  const inicioSemanaAnt = new Date(inicioSemana)
  inicioSemanaAnt.setDate(inicioSemana.getDate() - 7)
  const fimSemanaAnt = new Date(inicioSemana)
  fimSemanaAnt.setDate(inicioSemana.getDate() - 1)

  const toStr = (d: Date) => d.toISOString().slice(0, 10)

  // Contratos da semana atual
  const { data: contratos } = await supabase
    .from('contratos')
    .select('status, taxa, created_at, data_finalizacao')

  const isNaSemana = (c: any, ini: Date, fim: Date) => {
    const ref = new Date(c.data_finalizacao || c.created_at)
    return ref >= ini && ref <= fim && c.status === 'finalizado'
  }

  const semanaAtual  = (contratos ?? []).filter(c => isNaSemana(c, inicioSemana, fimSemana))
  const semanaAnt    = (contratos ?? []).filter(c => isNaSemana(c, inicioSemanaAnt, fimSemanaAnt))

  const receitaSemana    = semanaAtual.reduce((s, c) => s + Number(c.taxa), 0)
  const receitaSemanaAnt = semanaAnt.reduce((s, c) => s + Number(c.taxa), 0)
  const diffReceita      = receitaSemana - receitaSemanaAnt
  const diffEmoji        = diffReceita >= 0 ? '📈' : '📉'
  const diffTexto        = diffReceita >= 0
    ? `+R$ ${fmt(diffReceita)} vs semana passada`
    : `-R$ ${fmt(Math.abs(diffReceita))} vs semana passada`

  // Despesas lançadas na semana
  const { data: despesas } = await supabase
    .from('despesas')
    .select('valor, categoria, created_at')
    .gte('created_at', toStr(inicioSemana))
    .lte('created_at', toStr(fimSemana) + 'T23:59:59')

  const despesasSemana = (despesas ?? [])
    .filter(d => !['compra_divida', 'pl', 'devolucao_emprestimo', 'bonificacao'].includes(d.categoria))
    .reduce((s, d) => s + Number(d.valor), 0)

  // Progresso das metas do mês
  const finalizadosDoMes = (contratos ?? []).filter(c =>
    c.status === 'finalizado' && (c.data_finalizacao || c.created_at)?.slice(0, 7) === mes
  )
  const receitaMes = finalizadosDoMes.reduce((s, c) => s + Number(c.taxa), 0)

  const { data: metas } = await supabase
    .from('metas_vendedor')
    .select('vendedor, meta_receita')
    .eq('mes', mes)

  const metaTotal = (metas ?? []).reduce((s, m) => s + Number(m.meta_receita), 0)
  const pctMeta   = metaTotal > 0 ? (receitaMes / metaTotal) * 100 : 0
  const barSize   = 10
  const filled    = Math.round((pctMeta / 100) * barSize)
  const bar       = '█'.repeat(Math.min(filled, barSize)) + '░'.repeat(Math.max(barSize - filled, 0))

  const semanaLabel = `${inicioSemana.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${fimSemana.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`

  const saudacaoSemanal = 'Bom sábado'

  function buildResumoSemanal(nome: string) {
    return `${saudacaoSemanal}, ${nome}! 👋
Aqui é o *Jarvis*, assistente pessoal do Renan. Chegou a hora do balanço da semana!

━━━━━━━━━━━━━━━━━
📋 *CONTRATOS DA SEMANA*
• Finalizados: ${semanaAtual.length} → R$ ${fmt(receitaSemana)}
• ${diffEmoji} ${diffTexto}

━━━━━━━━━━━━━━━━━
💸 *DESPESAS DA SEMANA*
• Total lançado: R$ ${fmt(despesasSemana)}

━━━━━━━━━━━━━━━━━
🎯 *PROGRESSO DAS METAS — ${new Date().toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()}*
• Receita acumulada: R$ ${fmt(receitaMes)}
• Meta total: R$ ${fmt(metaTotal)}
• [${bar}] ${pctMeta.toFixed(1)}%

━━━━━━━━━━━━━━━━━
_Descansa que você merece! Até segunda. 😄_`
  }

  return { renan: buildResumoSemanal('Renan'), francisco: buildResumoSemanal('Francisco') }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo') ?? 'alertas'

  const phoneRenan     = process.env.ZAPI_PHONE ?? '5596981405293'
  const phoneFrancisco = '55969999139196'

  try {
    if (tipo === 'insights-consultores') {
      await enviarInsightsConsultores()
      return NextResponse.json({ ok: true, tipo: 'insights-consultores' })
    }

    if (tipo === 'resumo-semanal') {
      const msgs = await gerarResumoSemanal()
      await Promise.all([
        enviarWhatsapp(phoneRenan, msgs.renan),
        enviarWhatsapp(phoneFrancisco, msgs.francisco),
      ])
      return NextResponse.json({ ok: true, tipo: 'resumo-semanal' })
    }

    if (tipo === 'relatorio') {
      const msgs = await gerarRelatorioGeral()
      await Promise.all([
        enviarWhatsapp(phoneRenan, msgs.renan),
        enviarWhatsapp(phoneFrancisco, msgs.francisco),
      ])
      return NextResponse.json({ ok: true, tipo: 'relatorio' })
    }

    // Alertas operacionais (padrão)
    const alertas = await gerarAlertas()
    if (alertas.length === 0) {
      await enviarWhatsapp(phoneRenan,
        `✅ *BPX Dashboard — ${new Date().toLocaleDateString('pt-BR')}*\n\nTudo certo! Nenhum alerta no momento.`)
    } else {
      const msg = `🔔 *BPX Dashboard — ${new Date().toLocaleDateString('pt-BR')}*\n\n${alertas.join('\n')}`
      await enviarWhatsapp(phoneRenan, msg)
    }
    return NextResponse.json({ ok: true, tipo: 'alertas', alertas })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
