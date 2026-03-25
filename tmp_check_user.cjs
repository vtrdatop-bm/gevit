
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://xsmxdmhxohervcsocfhl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbXhkbWh4b2hlcnZjc29jZmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzczMDgsImV4cCI6MjA5MDAxMzMwOH0.xPQICXjY0Z11CEhACHT2KAESdWcjFtDGlTFsM8o7X-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUsers() {
  const { data, error } = await supabase.from('profiles').select('user_id').limit(1);
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('REAL_USER_ID_FOUND:' + data[0].user_id);
  } else {
    console.log('NO_USERS_FOUND');
  }
}

checkUsers();
