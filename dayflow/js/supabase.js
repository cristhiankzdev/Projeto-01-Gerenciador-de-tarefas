import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'COLE_SUA_URL_AQUI'
const SUPABASE_ANON_KEY = 'COLE_SUA_CHAVE_AQUI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
