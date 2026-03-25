'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffpeboanytasxoihrflz.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcGVib2FueXRhc3hvaWhyZmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODk4MjcsImV4cCI6MjA4OTM2NTgyN30.oHzk7R_MK5voPxAKrw9LnhtjGvw-C7xoxZXeWS9VFks'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
