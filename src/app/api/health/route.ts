import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'MISSING',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'MISSING',
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'ok' : 'MISSING',
  })
}
