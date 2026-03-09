'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qvvuugczogcirthsldar.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dnV1Z2N6b2djaXJ0aHNsZGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTAyMjYsImV4cCI6MjA4ODU4NjIyNn0.IQW5vk2VRQydOhHCOEYYK1ZBXHxxKlUND7WtUOsffcE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
