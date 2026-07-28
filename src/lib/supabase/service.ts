/**
 * Supabase service-role client — HANYA untuk operasi insert/update dari backend internal.
 *
 * SERVICE_ROLE_KEY = bypass RLS sepenuhnya.
 * Hanya boleh dipakai di server-side code yang trusted (cron, webhooks, internal API).
 * JANGAN pernah expose key ini ke client.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '❌ SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env'
  )
}

/**
 * Service-role client — immune terhadap RLS.
 * Hanya untuk operasi write dari backend internal.
 */
export const createServiceRoleClient = () =>
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })