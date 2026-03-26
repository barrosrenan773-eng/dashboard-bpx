import { NextResponse } from 'next/server'
import axios from 'axios'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Código de autorização não encontrado' }, { status: 400 })
  }

  const clientId = process.env.BLING_CLIENT_ID!
  const clientSecret = process.env.BLING_CLIENT_SECRET!
  const redirectUri = process.env.BLING_REDIRECT_URI || 'https://dashboard-sooty-psi.vercel.app/api/auth/bling/callback'

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const res = await axios.post(
      'https://www.bling.com.br/Api/v3/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const { access_token, refresh_token, expires_in } = res.data

    // Retorna HTML para o usuário copiar o refresh_token
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Bling Autorizado</title>
  <style>
    body { font-family: monospace; background: #18181b; color: #e4e4e7; padding: 40px; }
    .box { background: #27272a; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; max-width: 700px; }
    h2 { color: #34d399; margin-bottom: 16px; }
    .token { background: #18181b; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 13px; color: #a1a1aa; margin: 8px 0; }
    .label { color: #71717a; font-size: 12px; margin-top: 12px; }
    .success { color: #34d399; }
    .warning { color: #fbbf24; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>✓ Bling autorizado com sucesso!</h2>
    <p class="label">BLING_REFRESH_TOKEN (salve no .env.local e no Vercel):</p>
    <div class="token">${refresh_token}</div>
    <p class="label">Access Token (expira em ${expires_in}s — não precisa salvar):</p>
    <div class="token">${access_token}</div>
    <p class="warning">⚠ Copie o REFRESH TOKEN acima e adicione no .env.local como:<br>BLING_REFRESH_TOKEN=${refresh_token}</p>
  </div>
</body>
</html>`

    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  } catch (error: any) {
    const details = error.response?.data || error.message
    return NextResponse.json({ error: 'Falha ao trocar código por token', details }, { status: 500 })
  }
}
