import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Explicitly use Supabase's default project key so closure can remove this
// project's stored credentials even if the logout network request fails.
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})



export default supabase
