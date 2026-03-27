import { NextRequest, NextResponse } from 'next/server'
import { avancarParcelas } from '@/lib/parcelas'

// Vercel chama este endpoint via cron (vercel.json).
// O Authorization header com CRON_SECRET é adicionado automaticamente pelo Vercel.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Se CRON_SECRET estiver configurado, exige autenticação
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const geradas = await avancarParcelas()
    return NextResponse.json({ ok: true, parcelas_geradas: geradas })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
