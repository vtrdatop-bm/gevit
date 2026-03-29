CREATE OR REPLACE FUNCTION public.check_deadline_notifications(_user_id UUID)
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  v_prazo_120 INT := 120;
  v_elapsed INT;
  v_remaining INT;
  v_termo_remaining INT;
  v_role TEXT;
BEGIN
  -- Verificar a role do usuário (apenas admin e distribuidor recebem estes alertas gerais)
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF v_role NOT IN ('admin', 'distribuidor') THEN
    RETURN;
  END IF;

  -- Processos ativos (Regional, Pendencias, Certificado Termo)
  FOR rec IN
    SELECT p.id as processo_id, prot.numero as prot_numero, p.status, 
           v.data_1_vistoria, v.data_1_retorno, v.data_2_vistoria, v.data_2_retorno,
           t.data_validade
    FROM public.processos p
    JOIN public.protocolos prot ON prot.id = p.protocolo_id
    LEFT JOIN public.vistorias v ON v.processo_id = p.id
    LEFT JOIN public.termos_compromisso t ON t.processo_id = p.id
    WHERE p.status NOT IN ('certificado', 'expirado')
  LOOP
    -- 1. Check Certificado Provisório (validade)
    IF rec.status = 'certificado_termo' AND rec.data_validade IS NOT NULL THEN
      v_termo_remaining := DATE_PART('day', rec.data_validade::timestamp - current_date::timestamp);
      
      IF v_termo_remaining <= 0 THEN
        -- Termo Vencido
        IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = 'Certificado Provisório Vencido') THEN
          INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
          VALUES (_user_id, 'danger', 'Certificado Provisório Vencido', 'O termo do protocolo ' || rec.prot_numero || ' está vencido.', rec.processo_id);
        END IF;
      ELSIF v_termo_remaining <= 30 THEN
        -- Termo Vencendo em 30 dias
        IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = 'Certificado Provisório Próximo do Vencimento') THEN
          INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
          VALUES (_user_id, 'warning', 'Certificado Provisório Próximo do Vencimento', 'O termo do protocolo ' || rec.prot_numero || ' vence em ' || v_termo_remaining || ' dias.', rec.processo_id);
        END IF;
      END IF;
    END IF;

    -- 2. Check 120 days deadline
    v_elapsed := 0;
    IF rec.data_2_vistoria IS NOT NULL AND rec.data_2_retorno IS NULL THEN
      v_elapsed := DATE_PART('day', current_date::timestamp - rec.data_2_vistoria::timestamp);
    ELSIF rec.data_1_vistoria IS NOT NULL AND rec.data_1_retorno IS NULL THEN
      v_elapsed := DATE_PART('day', current_date::timestamp - rec.data_1_vistoria::timestamp);
    END IF;

    IF v_elapsed > 0 THEN
      -- Subtrair as pausas
      v_elapsed := v_elapsed - COALESCE(
        (SELECT SUM(DATE_PART('day', COALESCE(p_pausa.data_fim, current_date)::timestamp - p_pausa.data_inicio::timestamp))
         FROM public.pausas p_pausa WHERE p_pausa.processo_id = rec.processo_id), 
        0);

      v_remaining := v_prazo_120 - v_elapsed;

      IF v_remaining <= 0 THEN
         IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = 'Prazo de 120 dias Esgotado') THEN
            INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
            VALUES (_user_id, 'danger', 'Prazo de 120 dias Esgotado', 'O protocolo ' || rec.prot_numero || ' ultrapassou o limite de retorno de 120 dias.', rec.processo_id);
         END IF;
      ELSIF v_remaining <= 15 THEN
         IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = 'Prazo de 120 dias Próximo do Fim') THEN
            INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
            VALUES (_user_id, 'warning', 'Prazo de 120 dias Próximo do Fim', 'O protocolo ' || rec.prot_numero || ' expira em ' || v_remaining || ' dias.', rec.processo_id);
         END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
