import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xsmxdmhxohervcsocfhl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbXhkbWh4b2hlcnZjc29jZmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzczMDgsImV4cCI6MjA5MDAxMzMwOH0.xPQICXjY0Z11CEhACHT2KAESdWcjFtDGlTFsM8o7X-4');

async function check() {
    const { data: p1, error: e1 } = await supabase.from('protocolos').select('count', { count: 'exact' });
    console.log('Protocolos count:', p1, e1);

    const { data: p2, error: e2 } = await supabase.from('processos').select('count', { count: 'exact' });
    console.log('Processos count:', p2, e2);
    
    // Check for "protocolo" singular?
    const { data: p3, error: e3 } = await supabase.from('protocolo').select('count', { count: 'exact' });
    console.log('Protocolo count:', p3, e3);
}
check();
