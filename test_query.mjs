import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envPath = '.env'
let SUPABASE_URL = ''
let SUPABASE_ANON_KEY = ''

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  env.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim()
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_ANON_KEY = line.split('=')[1].trim()
  })
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase
    .from("protocolos")
    .select("id, numero, processos(regional_id, regionais(nome))")
    .limit(2)

  console.log(JSON.stringify({ data, error }, null, 2))
}
test()
