import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);

const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data: vistorias } = await supabase.from('vistorias').select('*');
  const { data: processos } = await supabase.from('processos').select('*');
  
  for (const v of vistorias) {
    let hasReprovado = v.status_1_vistoria === 'reprovado' || v.status_2_vistoria === 'reprovado' || v.status_3_vistoria === 'reprovado';
    if (hasReprovado) {
      const p = processos.find(p => p.id === v.processo_id);
      if (p) {
        // Compute what computeDisplayStatus would return
        let status = p.status;
        if (v) {
          if (v.status_3_vistoria) {
            if (v.status_3_vistoria === "pendencia") status = "expirado";
            else if (v.status_3_vistoria === "aprovado") status = "certificado_termo";
            else if (v.status_3_vistoria === "reprovado") status = "certificado";
          } else if (v.data_3_atribuicao) {
            status = "atribuido";
          } else if (v.data_2_retorno) {
            status = "aguardando_retorno";
          } else if (v.status_2_vistoria) {
             if (v.status_2_vistoria === "pendencia") status = "pendencias";
             else if (v.status_2_vistoria === "aprovado") status = "certificado_termo";
             else if (v.status_2_vistoria === "reprovado") status = "certificado";
          } else if (v.data_2_atribuicao) {
            status = "atribuido";
          } else if (v.data_1_retorno) {
            status = "aguardando_retorno";
          } else if (v.status_1_vistoria) {
             if (v.status_1_vistoria === "pendencia") status = "pendencias";
             else if (v.status_1_vistoria === "aprovado") status = "certificado_termo";
             else if (v.status_1_vistoria === "reprovado") status = "certificado";
          }
        }
        if (p.status === 'cancelado') status = 'cancelado';
        
        if (status !== 'certificado' && status !== 'expirado' && status !== 'cancelado') {
          console.log('Processo ID:', p.id, 'has reprovado but status is', status, 'dbStatus:', p.status);
          console.log(v);
        }
      }
    }
  }
}
run();
