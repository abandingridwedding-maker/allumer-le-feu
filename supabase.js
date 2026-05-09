import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://tgmpddenpmtedubsojdb.supabase.co'

const supabaseKey = 'sb_publishable_iI6ZWgkThqPKhEqg7ZghrA_PIqwvYSo'

export const supabase = createClient(supabaseUrl, supabaseKey)