import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xsmxdmhxohervcsocfhl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbXhkbWh4b2hlcnZjc29jZmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzczMDgsImV4cCI6MjA5MDAxMzMwOH0.xPQICXjY0Z11CEhACHT2KAESdWcjFtDGlTFsM8o7X-4');

async function check() {
    const { data: protocolos, error: err1 } = await supabase
        .from('protocolos')
        .select('id, evento_unico')
        .eq('evento_unico', true);

    if (err1) {
        console.error('Error fetching protocolos:', err1.message);
        return;
    }
    console.log('--- Protocolos (evento_unico = true) ---');
    console.log(JSON.stringify(protocolos, null, 2));

    const { data: processos, error: err2 } = await supabase
        .from('processos')
        .select('id, protocolo_id, status');

    if (err2) {
        console.error('Error fetching processos:', err2.message);
        return;
    }

    // Since filtering by JSON path might be tricky via JS client without knowing the schema perfectly, 
    // we'll filter them here if we have to, but first let's try to find them.
    // However, the prompt asks for 'protocolos->evento_unico' which suggests 'protocolos' is a column in 'processos' table.
    // Let's check the columns of 'processos'.
    
    console.log('\n--- Processos with protocols data ---');
    const filteredProcessos = processos.filter(p => p.protocolo_id); // Basic check
    
    // Attempting the specific query for processos
    const { data: processosFiltered, error: err3 } = await supabase
        .from('processos')
        .select('id, protocolo_id, status, protocolos(evento_unico)')
        .eq('protocolos.evento_unico', true);
        
    if (err3) {
        console.log('Error or join not possible directly:', err3.message);
        // Fallback: Check if 'protocolos' is a JSON column in 'processos'
        const { data: jsonCheck, error: err4 } = await supabase
            .from('processos')
            .select('id, protocolo_id, status, protocolos')
            .not('protocolos', 'is', null);
            
        if (!err4) {
            const result = jsonCheck.filter(p => p.protocolos && p.protocolos.evento_unico === true);
            console.log(JSON.stringify(result, null, 2));
            
            // Check for duplicates
            const protocolIds = result.map(p => p.protocolo_id);
            const duplicates = protocolIds.filter((item, index) => protocolIds.indexOf(item) !== index);
            if (duplicates.length > 0) {
                console.log('\nDUPLICATES FOUND for protocol_ids:', duplicates);
            } else {
                console.log('\nNo duplicate processes found for the same evento_unico protocol.');
            }
        }
    } else {
        console.log(JSON.stringify(processosFiltered, null, 2));
        const protocolIds = processosFiltered.map(p => p.protocolo_id);
        const duplicates = protocolIds.filter((item, index) => protocolIds.indexOf(item) !== index);
        if (duplicates.length > 0) {
            console.log('\nDUPLICATES FOUND for protocol_ids:', duplicates);
        } else {
            console.log('\nNo duplicate processes found for the same evento_unico protocol.');
        }
    }
}

check();
