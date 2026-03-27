import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

// Converte valor monetário "R$ 72.794,37" → 72794.37
function parseBRL(str: string): number | null {
  const m = str.match(/R\$\s*([\d.,]+)/)
  if (!m) return null
  const num = m[1].replace(/\./g, '').replace(',', '.')
  const v = parseFloat(num)
  return isNaN(v) ? null : v
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

// Extrai o valor na linha seguinte ou na mesma linha de uma palavra-chave
function extrairAposChave(lines: string[], chave: string): string | null {
  const idx = lines.findIndex(l => l.toUpperCase().includes(chave.toUpperCase()))
  if (idx === -1) return null
  // Tenta linha atual (pode ter o valor na mesma linha)
  const linhaAtual = lines[idx]
  const mAtual = linhaAtual.match(/R\$\s*[\d.,]+/)
  if (mAtual) return mAtual[0]
  // Tenta próximas 3 linhas
  for (let i = idx + 1; i <= Math.min(idx + 3, lines.length - 1); i++) {
    const m = lines[i].match(/R\$\s*[\d.,]+/)
    if (m) return m[0]
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
    const fullText = lines.join(' ')

    // ── Nome do cliente ──────────────────────────────────────────────
    // Tenta "Nome:" ou "NOME:" ou o padrão de nome completo em maiúsculas
    let nome: string | null = null
    const nomeIdx = lines.findIndex(l =>
      /\bNOME\b/i.test(l) || /\bCONTRATANTE\b/i.test(l) || /\bCLIENTE\b/i.test(l)
    )
    if (nomeIdx !== -1) {
      // Tenta extrair o nome da mesma linha ou da próxima
      const candidatos = [lines[nomeIdx], lines[nomeIdx + 1] ?? '']
      for (const c of candidatos) {
        // Nome em maiúsculas: 2+ palavras, só letras e espaços
        const m = c.match(/[A-ZÀÁÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]{8,}/)
        if (m && !/(SALDO|DEVEDOR|SERVIÇO|FINANCEIRO|CAPITAL|TOTAL|VENCIMENTO|CPF|DATA|CONTRATO)/.test(m[0])) {
          nome = m[0].trim()
          break
        }
      }
    }
    // Fallback: procura por CPF e pega o nome antes dele
    if (!nome) {
      const cpfIdx = lines.findIndex(l => /CPF[:\s]/.test(l))
      if (cpfIdx > 0) {
        const prev = lines[cpfIdx - 1]
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]{10,}$/.test(prev)) nome = prev.trim()
      }
    }

    // ── Capital = SALDO DEVEDOR ──────────────────────────────────────
    const capitalStr = extrairAposChave(lines, 'SALDO DEVEDOR')
    const capital = capitalStr ? parseBRL(capitalStr) : null

    // ── Taxa = SERVIÇOS FINANCEIROS ──────────────────────────────────
    const taxaStr =
      extrairAposChave(lines, 'SERVIÇOS FINANCEIROS') ??
      extrairAposChave(lines, 'SERVICOS FINANCEIROS') ??
      extrairAposChave(lines, 'SERVIÇO FINANCEIRO') ??
      extrairAposChave(lines, 'TAXA')
    const taxa = taxaStr ? parseBRL(taxaStr) : null

    // ── Total devedor (informativo) ──────────────────────────────────
    const totalStr = extrairAposChave(lines, 'TOTAL DEVEDOR')
    const total = totalStr ? parseBRL(totalStr) : null

    // ── Troco (informativo) ──────────────────────────────────────────
    const trocoStr = extrairAposChave(lines, 'TROCO')
    const troco = trocoStr ? parseBRL(trocoStr) : null

    // ── Vencimento ───────────────────────────────────────────────────
    let vencimento: string | null = null
    // Procura datas por extenso em todo o texto
    const dataExtensa = fullText.match(/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi)
    if (dataExtensa) {
      // Prefere datas perto de "vencimento" ou "vencer"
      const vencIdx = lines.findIndex(l => /VENCIMENTO|VENCER/i.test(l))
      if (vencIdx !== -1) {
        for (let i = vencIdx; i <= Math.min(vencIdx + 5, lines.length - 1); i++) {
          const d = parseDataExtenso(lines[i])
          if (d) { vencimento = d; break }
        }
      }
      if (!vencimento) vencimento = parseDataExtenso(dataExtensa[0])
    }
    // Tenta também data no formato DD/MM/AAAA
    if (!vencimento) {
      const mData = fullText.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (mData) vencimento = `${mData[3]}-${mData[2]}-${mData[1]}`
    }

    // ── Tipo de serviço ──────────────────────────────────────────────
    // Tenta identificar PORTABILIDADE, REFINANCIAMENTO, EMPRÉSTIMO, etc.
    let servico = 'Crédito Consignado'
    if (/PORTABILIDADE/i.test(fullText)) servico = 'Portabilidade'
    else if (/REFINANCIAMENTO/i.test(fullText)) servico = 'Refinanciamento'
    else if (/EMPRÉSTIMO|EMPRESTIMO/i.test(fullText)) servico = 'Empréstimo Consignado'
    else if (/FGTS/i.test(fullText)) servico = 'FGTS'
    else if (/CARTÃO|CARTAO/i.test(fullText)) servico = 'Cartão Consignado'

    const campos = { nome, capital, taxa, total, troco, vencimento, servico }

    // Identifica campos não encontrados
    const naoEncontrados: string[] = []
    if (!nome)       naoEncontrados.push('Nome do cliente')
    if (!capital)    naoEncontrados.push('Capital (Saldo Devedor)')
    if (!taxa)       naoEncontrados.push('Taxa (Serviços Financeiros)')
    if (!vencimento) naoEncontrados.push('Vencimento')

    return NextResponse.json({ ok: true, campos, naoEncontrados, rawText: rawText.slice(0, 2000) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
