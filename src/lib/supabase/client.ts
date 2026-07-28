/**
 * Supabase browser client — untuk digunakan di client components (useEffect, event handlers, etc.)
 * Gunakan createClient() dari @supabase/supabase-js
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi di .env'
  )
}

export const createBrowserClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // ViraLoop tidak perlu session user — pure API key auth
      autoRefreshToken: false,
    },
  })