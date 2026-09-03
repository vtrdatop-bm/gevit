import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);

const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'process_status' });
  if (error) {
    const { data: res, error: err2 } = await supabase.from('processos').select('*').limit(1);
    console.log("fallback", res, err2);
  } else {
    console.log("enum:", data);
  }
}
run();
