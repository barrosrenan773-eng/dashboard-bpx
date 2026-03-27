import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * Avança parcelas automáticas: para cada conta parcelada cujo vencimento
 * já passou do mês atual, verifica se a próxima parcela existe. Se não,
 * cria-a. Retorna quantas parcelas foram geradas.
 *
 * Idempotente: pode ser chamada várias vezes sem duplicar.
 */
export async function avancarParcelas(): Promise<number> {
  const hoje = new Date()
  // Início do mês atual — parcelas com vencimento ANTES disso são candidatas
  const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  // Busca contas parceladas com vencimento já passado do mês atual e ainda não na última parcela
  const { data: candidatas, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .not('parcelamento_id', 'is', null)
    .lt('data_vencimento', inicioMesAtual)

  if (error || !candidatas || candidatas.length === 0) return 0

  let count = 0

  for (const conta of candidatas) {
    const parcelaAtual: number = conta.parcela_atual ?? 0
    const totalParcelas: number = conta.total_parcelas ?? 0

    if (parcelaAtual <= 0 || totalParcelas <= 0) continue
    if (parcelaAtual >= totalParcelas) continue // já na última parcela

    const proximaNum = parcelaAtual + 1

    // Verifica se a próxima parcela já foi gerada (idempotência)
    const { data: existing } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('parcelamento_id', conta.parcelamento_id)
      .eq('parcela_atual', proximaNum)
      .maybeSingle()

    if (existing) continue

    // Calcula próximo vencimento (+1 mês, mantendo o dia)
    const vencAtual = new Date(conta.data_vencimento + 'T12:00:00')
    const vencProximo = new Date(
      vencAtual.getFullYear(),
      vencAtual.getMonth() + 1,
      vencAtual.getDate()
    )
    const dataVencProxima = vencProximo.toISOString().slice(0, 10)
    const hojeStr = hoje.toISOString().slice(0, 10)
    const statusProxima = dataVencProxima < hojeStr ? 'vencido' : 'a_vencer'

    await supabase.from('contas_pagar').insert({
      descricao: conta.descricao,
      fornecedor: conta.fornecedor || '',
      categoria: conta.categoria || 'outros',
      valor: conta.valor,
      data_vencimento: dataVencProxima,
      status: statusProxima,
      parcela_atual: proximaNum,
      total_parcelas: totalParcelas,
      parcelamento_id: conta.parcelamento_id,
    })

    count++
  }

  return count
}
