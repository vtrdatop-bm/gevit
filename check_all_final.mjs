import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('protocolos')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('All protocols:', JSON.stringify(data, null, 2));
    }
}
check();
