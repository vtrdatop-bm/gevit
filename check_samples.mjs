import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('protocolos')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log('--- Sample Protocols (First 5) ---');
    data.forEach(p => {
        console.log(`ID: ${p.id} | Evento Unico: ${p.evento_unico} | Processo ID: ${p.processo_id}`);
    });
}
check();
