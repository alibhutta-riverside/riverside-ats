import { createClient } from "@supabase/supabase-js";

// ⚠️ Replace these with YOUR Supabase project values
// Find them in: Supabase Dashboard → Settings → API
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "YOUR-ANON-PUBLIC-KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
