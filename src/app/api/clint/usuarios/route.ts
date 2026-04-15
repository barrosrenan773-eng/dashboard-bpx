export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { fetchTodosUsuarios } from '@/lib/clint'

// Cache simples por 5 minutos — a lista de usuários muda raramente
let cache: { data: { id: string; nome: string }[]; at: number } | null = null
const TTL = 5 * 60 * 1000

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.data)
  }
  const token = (process.env.CLINT_API_TOKEN || process.env.CLINT_API_KEY || '').trim()
  if (!token) return NextResponse.json([])
  const usuarios = await fetchTodosUsuarios(token)
  cache = { data: usuarios, at: Date.now() }
  return NextResponse.json(usuarios)
}
