import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xsmxdmhxohervcsocfhl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbXhkbWh4b2hlcnZjc29jZmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzczMDgsImV4cCI6MjA5MDAxMzMwOH0.xPQICXjY0Z11CEhACHT2KAESdWcjFtDGlTFsM8o7X-4');

async function run() {
  const { data: vistorias, count: vc } = await supabase.from('vistorias').select('*', { count: 'exact' });
  console.log('Total vistorias:', vc, vistorias?.length);
  if (vistorias && vistorias.length > 0) console.log(vistorias[0]);

  const { data: processos, count: pc } = await supabase.from('processos').select('*', { count: 'exact' });
  console.log('Total processos:', pc, processos?.length);
  if (processos && processos.length > 0) {
    console.log(processos[0]);
    console.log("Statuses: ", [...new Set(processos.map(p => p.status))]);
  }
}

run();
