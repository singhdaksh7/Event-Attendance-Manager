import { createClient } from '@supabase/supabase-js'

/**
 * Admin Supabase client — uses service role key.
 * ONLY use in server-side code (API routes, Server Components).
 * Never expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
