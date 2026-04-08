export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export type OFXTransaction = {
  fitid: string
  tipo: 'DEBIT' | 'CREDIT' | string
  data: string   // YYYY-MM-DD
  valor: number  // sempre positivo
  descricao: string
  mes: string    // YYYY-MM
}

function parseOFX(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = []
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const getField = (block: string, name: string) => {
    const m = new RegExp(`<${name}>([^<\n\r]+)`, 'i').exec(block)
    return m ? m[1].trim() : ''
  }

  // Tenta XML primeiro (com tags de fechamento </STMTTRN>)
  const xmlBlocks: string[] = []
  const xmlRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let m: RegExpExecArray | null
  while ((m = xmlRegex.exec(text)) !== null) xmlBlocks.push(m[1])

  // Se não encontrou blocos XML, tenta SGML (sem tags de fechamento — padrão dos bancos BR)
  const blocks: string[] = xmlBlocks.length > 0 ? xmlBlocks : (() => {
    const sgmlBlocks: string[] = []
    // Divide pelo início de cada transação <STMTTRN>
    const parts = text.split(/<STMTTRN>/i)
    for (let i = 1; i < parts.length; i++) {
      // Bloco vai até o próximo <STMTTRN> ou até </BANKTRANLIST> ou fim
      const end = parts[i].search(/<\/STMTTRN>|<\/BANKTRANLIST>|<BANKTRANLIST>/i)
      sgmlBlocks.push(end >= 0 ? parts[i].slice(0, end) : parts[i])
    }
    return sgmlBlocks
  })()

  for (const block of blocks) {
    const fitid = getField(block, 'FITID')
    const tipo = getField(block, 'TRNTYPE').toUpperCase()
    const dtposted = getField(block, 'DTPOSTED')
    const trnamt = getField(block, 'TRNAMT')
    const memo = getField(block, 'MEMO') || getField(block, 'NAME') || getField(block, 'PAYEEID') || ''

    // Parse de data: 20260301120000[-03:BRT] → 2026-03-01
    const rawDate = dtposted.replace(/\[.*\]/, '').slice(0, 8)
    if (rawDate.length < 8) continue
    const data = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    const mes = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}`

    const valor = Math.abs(parseFloat(trnamt.replace(',', '.')) || 0)
    if (!fitid || valor === 0) continue

    transactions.push({ fitid, tipo, data, valor, descricao: memo, mes })
  }

  // Garante FITIDs únicos (alguns bancos BR repetem o mesmo FITID)
  const seenFitids = new Map<string, number>()
  for (const t of transactions) {
    const count = seenFitids.get(t.fitid) ?? 0
    if (count > 0) t.fitid = `${t.fitid}_${count}`
    seenFitids.set(t.fitid.replace(/_\d+$/, ''), count + 1)
  }

  return transactions.sort((a, b) => a.data.localeCompare(b.data))
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    const content = await file.text()
    const transactions = parseOFX(content)

    return NextResponse.json({ transactions, total: transactions.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
