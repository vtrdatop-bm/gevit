import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);

const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data } = await supabase.from('vistorias').select('*');
  let count = 0;
  for (const v of data) {
    let certs = 0;
    if (v.status_1_vistoria === 'reprovado') certs++;
    if (v.status_2_vistoria === 'reprovado') certs++;
    if (v.status_3_vistoria === 'reprovado') certs++;
    if (certs > 1) {
      count++;
      console.log('Processo ID:', v.processo_id, 'has', certs, 'reprovado vistorias.');
    }
  }
  console.log('Total processes with multiple reprovado:', count);
}
run();
