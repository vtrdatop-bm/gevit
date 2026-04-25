import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xsmxdmhxohervcsocfhl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbXhkbWh4b2hlcnZjc29jZmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzczMDgsImV4cCI6MjA5MDAxMzMwOH0.xPQICXjY0Z11CEhACHT2KAESdWcjFtDGlTFsM8o7X-4');

async function check() {
    // 1. SELECT id, evento_unico FROM protocolos WHERE evento_unico = true;
    const { data: q1, error: e1 } = await supabase
        .from('protocolos')
        .select('id, evento_unico')
        .eq('evento_unico', true);
    console.log('Q1 Results:', q1);
    if (e1) console.error('E1:', e1);

    // 2. SELECT id, protocolo_id, status, protocolos->evento_unico FROM processos WHERE protocolos->evento_unico = true;
    // Assuming 'protocolos' is a JSONB column in 'processos'
    const { data: q2, error: e2 } = await supabase
        .from('processos')
        .select('id, protocolo_id, status, protocolos')
        .eq('protocolos->evento_unico', true);
    
    // If that fails, try simpler query to see structure
    if (e2) {
        console.log('Q2 failed with arrow syntax, trying alternate...');
        const { data: q2b, error: e2b } = await supabase
            .from('processos')
            .select('id, protocolo_id, status, protocolos')
            .limit(5);
        console.log('Processos Sample:', q2b);
        
        const manualFilter = q2b ? q2b.filter(p => p.protocolos && p.protocolos.evento_unico === true) : [];
        console.log('Manual Filter Results:', manualFilter);
    } else {
        console.log('Q2 Results:', q2);
    }
}
check();
