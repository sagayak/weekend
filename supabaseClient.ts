
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ewfjnmkbfucvnnxulskb.supabase.co';
const supabaseAnonKey = 'sb_publishable_6KA3VwZBFrY9bhwHqChBsA_ELAOh2yx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
