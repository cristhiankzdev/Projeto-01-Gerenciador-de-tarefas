import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://cvytjwyfiablzaduooya.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2eXRqd3lmaWFibHphZHVvb3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTY5MzcsImV4cCI6MjA5MDE5MjkzN30.gcQSjDeoi2_qt_dPhMS0LBjQhIWrMC6zP6HkvJmBmV4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
