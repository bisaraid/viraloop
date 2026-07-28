/**
 * Supabase server client — untuk digunakan di Server Components, Route Handlers, Server Actions
 * Menggunakan anon key, tetap terikat RLS policy (public read only).
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ SUPABASE_URL dan SUPABASE_ANON_KEY wajib diisi di .env'
  )
}

/**
 * Server client dengan anon key — untuk read-only public data dari server side.
 * Ini tetap terikat RLS policy (public read).
 */
export const createServerClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })