import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

// Converte valor monetário "R$ 72.794,37" ou "72.794,37" → 72794.37
function parseBRL(str: string): number | null {
  // Aceita com ou sem "R$"
  const m = str.match(/(?:R\$\s*)?([\d]+(?:\.\d{3})*(?:,\d{1,2})?)/)
  if (!m) return null
  const num = m[1].replace(/\./g, '').replace(',', '.')
  const v = parseFloat(num)
  return isNaN(v) || v <= 0 ? null : v
}

// Extrai data no formato "23 de março de 2026" → "2026-03-23"
function parseDataExtenso(str: string): string | null {
  const meses: Record<string, string> = {
    janeiro: '01', fevereiro: '02', março: '03', abril: '04',
    maio: '05', junho: '06', julho: '07', agosto: '08',
    setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
  }
  const m = str.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i)
  if (!m) return null
  const mes = meses[m[2].toLowerCase()]
  if (!mes) return null
  return `${m[3]}-${mes}-${String(m[1]).padStart(2, '0')}`
}

/**
 * Estratégia de extração precisa:
 * 1. Concatena todo texto em uma linha única para facilitar regex
 * 2. Busca o padrão "PALAVRA-CHAVE ... R$ valor" com no máximo ~100 chars entre eles
 * 3. Só considera o PRIMEIRO match para cada chave
 */
function extrairValorAposChave(fullText: string, chaves: string[]): number | null {
  for (const chave in chaves) {
    const key = chaves[chave]
    // Busca a chave seguida de qualquer coisa e depois R$ valor (até 150 chars depois)
    const re = new RegExp(
      key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[^R]{0,150}?R\\$\\s*([\\d]+(?:\\.[\\d]{3})*(?:,[\\d]{1,2})?)',
      'i'
    )
    const m = fullText.match(re)
    if (m) {
      const v = parseBRL(m[1])
      if (v && v > 100) return v  // ignora valores muito pequenos (taxas percentuais, etc.)
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { value: rawText } = await mammoth.extractRawText({ buffer })

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
    // Versão compacta do texto (sem quebras) para regex span
    const compact = rawText.replace(/\s+/g, ' ').toUpperCase()

    // ── Nome do cliente ──────────────────────────────────────────────
    let nome: string | null = null

    // Estratégia 1: linha com "NOME:" ou "CONTRATANTE:" e pega o que vem depois
    for (const line of lines) {
      const mNome = line.match(/^(?:NOME|CONTRATANTE|CLIENTE)[:\s]+(.{5,})/i)
      if (mNome) {
        const candidato = mNome[1].trim()
        // Deve ser só letras/espaços (nome próprio), sem números ou símbolos
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇa-záàâãéêíóôõúüç\s]{4,}$/.test(candidato)) {
          nome = candidato.trim()
          break
        }
      }
    }

    // Estratégia 2: linha inteiramente em maiúsculas com 2+ palavras (nome completo)
    if (!nome) {
      for (const line of lines) {
        if (
          /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]{10,}$/.test(line) &&
          line.split(' ').length >= 2 &&
          !/(SALDO|DEVEDOR|SERVIÇ|FINANCEIRO|CAPITAL|TOTAL|VENCIMENTO|CPF|DATA|CONTRATO|PORTABILIDADE|REFINANCIAMENTO|MARGEM|BANCO|PARCELA|PRAZO|VALOR|TAXA|EMPRÉSTIMO)/.test(line)
        ) {
          nome = line.trim()
          break
        }
      }
    }

    // Estratégia 3: linha anterior ao CPF
    if (!nome) {
      const cpfIdx = lines.findIndex(l => /CPF[:\s]/i.test(l))
      if (cpfIdx > 0) {
        const prev = lines[cpfIdx - 1]
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]{10,}$/.test(prev)) nome = prev.trim()
      }
    }

    // ── Capital = SALDO DEVEDOR ──────────────────────────────────────
    // Busca exata: "SALDO DEVEDOR" seguido do valor (ignora valores de margem que aparecem antes)
    let capital: number | null = null
    {
      // Tenta na versão compacta: "SALDO DEVEDOR" ... R$ valor
      const reSaldo = /SALDO\s+DEVEDOR[^R]{0,200}?R\$\s*([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)/i
      const mSaldo = compact.match(reSaldo)
      if (mSaldo) capital = parseBRL(mSaldo[1])

      // Fallback linha a linha
      if (!capital) {
        const idx = lines.findIndex(l => /SALDO\s+DEVEDOR/i.test(l))
        if (idx !== -1) {
          // Verifica a própria linha e as 2 seguintes
          for (let i = idx; i <= Math.min(idx + 2, lines.length - 1); i++) {
            const m = lines[i].match(/R\$\s*([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)/)
            if (m) { capital = parseBRL(m[1]); break }
          }
        }
      }
    }

    // ── Taxa = SERVIÇOS FINANCEIROS ──────────────────────────────────
    let taxa: number | null = null
    {
      const chavesTaxa = [
        'SERVIÇOS FINANCEIROS',
        'SERVICOS FINANCEIROS',
        'SERVIÇO FINANCEIRO',
        'SERVICO FINANCEIRO',
        'HONORÁRIOS',
        'HONORARIOS',
      ]
      for (const chave of chavesTaxa) {
        const re = new RegExp(
          chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '[^R]{0,200}?R\\$\\s*([\\d]+(?:\\.[\\d]{3})*(?:,[\\d]{1,2})?)',
          'i'
        )
        const m = compact.match(re)
        if (m) { taxa = parseBRL(m[1]); break }

        // Fallback linha a linha
        if (!taxa) {
          const idx = lines.findIndex(l => new RegExp(chave, 'i').test(l))
          if (idx !== -1) {
            for (let i = idx; i <= Math.min(idx + 2, lines.length - 1); i++) {
              const mL = lines[i].match(/R\$\s*([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)/)
              if (mL) { taxa = parseBRL(mL[1]); break }
            }
            if (taxa) break
          }
        }
      }
    }

    // ── Total devedor (informativo) ──────────────────────────────────
    let total: number | null = null
    {
      const reTotal = /TOTAL\s+DEVEDOR[^R]{0,200}?R\$\s*([\d]+(?:\.[\d]{3})*(?:,[\d]{1,2})?)/i
      const mTotal = compact.match(reTotal)
      if (mTotal) total = parseBRL(mTotal[1])
    }

    // ── Vencimento ───────────────────────────────────────────────────
    let vencimento: string | null = null
    {
      // Prefere data perto de "vencimento" ou "vencer"
      const vencIdx = lines.findIndex(l => /VENCIMENTO|VENCER/i.test(l))
      if (vencIdx !== -1) {
        for (let i = vencIdx; i <= Math.min(vencIdx + 5, lines.length - 1); i++) {
          const d = parseDataExtenso(lines[i])
          if (d) { vencimento = d; break }
        }
      }
      // Qualquer data por extenso no texto
      if (!vencimento) {
        const dataExtensa = rawText.match(/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi)
        if (dataExtensa) vencimento = parseDataExtenso(dataExtensa[0])
      }
      // Data no formato DD/MM/AAAA
      if (!vencimento) {
        const mData = rawText.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (mData) vencimento = `${mData[3]}-${mData[2]}-${mData[1]}`
      }
    }

    // ── Tipo de serviço ──────────────────────────────────────────────
    let servico = 'Crédito Consignado'
    if (/PORTABILIDADE/i.test(compact)) servico = 'Portabilidade'
    else if (/REFINANCIAMENTO/i.test(compact)) servico = 'Refinanciamento'
    else if (/EMPRÉSTIMO|EMPRESTIMO/i.test(compact)) servico = 'Empréstimo Consignado'
    else if (/FGTS/i.test(compact)) servico = 'FGTS'
    else if (/CARTÃO|CARTAO/i.test(compact)) servico = 'Cartão Consignado'

    const campos = { nome, capital, taxa, total, vencimento, servico }

    const naoEncontrados: string[] = []
    if (!nome)       naoEncontrados.push('Nome do cliente')
    if (!capital)    naoEncontrados.push('Capital (Saldo Devedor)')
    if (!taxa)       naoEncontrados.push('Taxa (Serviços Financeiros)')
    if (!vencimento) naoEncontrados.push('Vencimento')

    // rawText retornado para debug (primeiros 3000 chars)
    return NextResponse.json({ ok: true, campos, naoEncontrados, rawText: rawText.slice(0, 3000) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
