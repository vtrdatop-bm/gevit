
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUsers() {
  const { data, error } = await supabase.from('profiles').select('user_id').limit(1);
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  console.log('Real User ID found:', data[0]?.user_id);
}

checkUsers();
