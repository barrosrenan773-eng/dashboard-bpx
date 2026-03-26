import { NextResponse } from 'next/server'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getStoredRefreshToken(): Promise<string> {
  const { data } = await supabase
    .from('bling_tokens')
    .select('refresh_token')
    .eq('id', 1)
    .single()
  return data?.refresh_token || process.env.BLING_REFRESH_TOKEN!
}

async function saveRefreshToken(token: string) {
  await supabase
    .from('bling_tokens')
    .upsert({ id: 1, refresh_token: token, updated_at: new Date().toISOString() })
}

async function getAccessToken() {
  const clientId = process.env.BLING_CLIENT_ID!
  const clientSecret = process.env.BLING_CLIENT_SECRET!
  const refreshToken = await getStoredRefreshToken()

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await axios.post(
    'https://www.bling.com.br/Api/v3/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  // Salva o novo refresh token para a próxima chamada
  if (res.data.refresh_token) {
    await saveRefreshToken(res.data.refresh_token)
  }

  return res.data.access_token as string
}

async function blingGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://www.bling.com.br/Api/v3${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await axios.get(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  return res.data
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''

  if (!process.env.BLING_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'BLING_REFRESH_TOKEN não configurado', produtos: [] })
  }

  try {
    const token = await getAccessToken()

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    // 1. Busca catálogo de produtos com custos (todas as páginas, todos os tipos)
    const custosMap: Record<string, number> = {} // chave: codigo, nome ou id (string)
    let prodPage = 1
    while (true) {
      const prodData = await blingGet('/produtos', token, {
        pagina: String(prodPage),
        limite: '100',
      })
      await sleep(350)
      const prods = prodData?.data || []
      for (const p of prods) {
        const custo = Number(p.precoCusto) || 0
        if (p.codigo) custosMap[p.codigo] = custo
        if (p.id) custosMap[String(p.id)] = custo
        if (p.nome) custosMap[p.nome] = custosMap[p.nome] ?? custo
      }
      if (prods.length < 100) break
      prodPage++
      if (prodPage > 20) break
    }

    // 2. Busca pedidos de venda no período (lista já inclui itens resumidos)
    const allPedidos: any[] = []
    let page = 1
    const limit = 100

    while (true) {
      await sleep(350)
      const data = await blingGet('/pedidos/vendas', token, {
        pagina: String(page),
        limite: String(limit),
        dataInicial: start,
        dataFinal: end,
        'situacoes[0]': '9', // Atendido
      })

      const pedidos = data?.data || []
      allPedidos.push(...pedidos)

      if (pedidos.length < limit) break
      page++
      if (page > 10) break
    }

    // 3. Receita total e clientes únicos
    const totalReceita = allPedidos.reduce((s, p) => s + (Number(p.totalProdutos) || Number(p.total) || 0), 0)
    const uniqueClientes = new Set(allPedidos.map(p => p.contato?.id || p.contato?.nome || '').filter(Boolean)).size

    // 4. Agrega itens por produto — busca detalhes em lotes pequenos (para tabela e CMV)
    const produtosMap: Record<string, {
      name: string
      sku: string
      quantity: number
      revenue: number
      cost: number
      orders: number
    }> = {}

    // Limita a 60 pedidos para não estourar o timeout (60 × 350ms ≈ 21s)
    const pedidosParaDetalhe = allPedidos.slice(0, 60)
    for (let i = 0; i < pedidosParaDetalhe.length; i++) {
      try {
        await sleep(350)
        const detail = await blingGet(`/pedidos/vendas/${pedidosParaDetalhe[i].id}`, token)
        const itens = detail?.data?.itens || []

        for (const item of itens) {
          const key = item.produto?.codigo || item.produto?.nome || item.descricao || 'Desconhecido'
          const name = item.produto?.nome || item.descricao || key
          const qty = Number(item.quantidade) || 0
          const priceUnit = Number(item.valor) || 0
          // Tenta match por código, id, nome — usa custo do catálogo (precoCusto)
          const itemId = String(item.produto?.id || '')
          const costUnit = custosMap[key] ?? custosMap[itemId] ?? Number(item.produto?.precoCusto) ?? 0

          if (!produtosMap[key]) {
            produtosMap[key] = { name, sku: key, quantity: 0, revenue: 0, cost: 0, orders: 0 }
          }
          produtosMap[key].quantity += qty
          produtosMap[key].revenue += priceUnit * qty
          produtosMap[key].cost += costUnit * qty
          produtosMap[key].orders += 1
        }
      } catch {
        // ignora erros individuais
      }
    }

    const produtos = Object.values(produtosMap)
      .map(p => ({
        ...p,
        lucro: p.revenue - p.cost,
        margem: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
        avgTicket: p.orders > 0 ? p.revenue / p.orders : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // CMV: soma dos custos da amostra; escala proporcionalmente se houver mais pedidos
    const receitaAmostra = produtos.reduce((s, p) => s + p.revenue, 0)
    const custoAmostra = produtos.reduce((s, p) => s + p.cost, 0)
    const fatorEscala = receitaAmostra > 0 ? totalReceita / receitaAmostra : 1
    const totalCusto = custoAmostra * fatorEscala

    const totalLucro = totalReceita - totalCusto
    const margemGeral = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0

    return NextResponse.json({
      produtos,
      totalReceita,
      totalCusto,
      totalLucro,
      margemGeral,
      totalPedidos: allPedidos.length,
      uniqueClientes,
      pedidosComDetalhe: pedidosParaDetalhe.length,
    })
  } catch (error: any) {
    const details = error.response?.data || error.message
    return NextResponse.json({ error: 'Erro ao buscar Bling', details, produtos: [] }, { status: 500 })
  }
}
