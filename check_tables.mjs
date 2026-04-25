import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data: tables, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    if (error) {
        // information_schema might not be accessible via API, let's try RPC or listing something else
        console.error('Error fetching tables via select:', error);
    } else {
        console.log('Tables:', tables);
    }
}
check();
