import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.BLING_CLIENT_ID!
  const redirectUri = process.env.BLING_REDIRECT_URI || 'https://dashboard-sooty-psi.vercel.app/api/auth/bling/callback'
  const state = Math.random().toString(36).slice(2)

  const url = new URL('https://www.bling.com.br/Api/v3/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(url.toString())
}
