import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('protocolos')
        .select('*')
        .eq('evento_unico', true);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log('--- Protocols where evento_unico = true ---');
    console.log('Total count:', data.length);
    
    const ids = data.map(p => p.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    
    if (duplicates.length > 0) {
        console.log('Found duplicate IDs:', duplicates);
    } else {
        console.log('No duplicate IDs found.');
    }

    data.forEach(p => {
        console.log(`ID: ${p.id} | Processo ID: ${p.processo_id} | Tipo: ${p.tipo} | Data: ${p.data_protocolo}`);
    });
}
check();
