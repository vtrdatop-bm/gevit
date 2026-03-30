-- 1. Remover notificações de resultados de vistorias (Admins e Distribuidores não querem mais)
DROP TRIGGER IF EXISTS on_vistoria_result ON public.vistorias;
DROP FUNCTION IF EXISTS public.notify_vistoria_result();

-- 2. Atualizar a função de verificação de prazos para incluir novos marcos e suporte a Vistoriadores
CREATE OR REPLACE FUNCTION public.check_deadline_notifications(_user_id UUID)
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  v_prazo_120 INT := 120;
  v_elapsed INT;
  v_remaining INT;
  v_termo_remaining INT;
  v_role TEXT;
  v_milestone INT;
  v_milestones INT[] := ARRAY[1, 5, 10, 15, 30];
  v_title TEXT;
  v_desc TEXT;
  v_tipo TEXT;
BEGIN
  -- Verificar a role do usuário
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  -- Se não tiver role definida (raro), sai
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  -- Processos ativos (Regional, Pendencias, Certificado Termo)
  FOR rec IN
    SELECT p.id as processo_id, prot.numero as prot_numero, p.status, p.vistoriador_id,
           v.data_1_vistoria, v.data_1_retorno, v.data_2_vistoria, v.data_2_retorno,
           t.data_validade
    FROM public.processos p
    JOIN public.protocolos prot ON prot.id = p.protocolo_id
    LEFT JOIN public.vistorias v ON v.processo_id = p.id
    LEFT JOIN public.termos_compromisso t ON t.processo_id = p.id
    WHERE p.status NOT IN ('certificado', 'expirado')
    -- Se for vistoriador, filtra apenas os dele
    AND (
      v_role IN ('admin', 'distribuidor') 
      OR (v_role = 'vistoriador' AND p.vistoriador_id = _user_id)
      OR (v_role = 'vistoriador' AND (v.vistoriador_1_id = _user_id OR v.vistoriador_2_id = _user_id OR v.vistoriador_3_id = _user_id))
    )
  LOOP
    
    ---------------------------------------------------------
    -- 1. Check Certificado Provisório (Vencimento Próximo)
    ---------------------------------------------------------
    IF rec.status = 'certificado_termo' AND rec.data_validade IS NOT NULL THEN
      v_termo_remaining := DATE_PART('day', rec.data_validade::timestamp - current_date::timestamp);
      
      IF v_termo_remaining <= 0 THEN
        v_title := 'Certificado Vencido';
        v_desc := 'O termo do protocolo ' || rec.prot_numero || ' está vencido.';
        IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = v_title) THEN
          INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
          VALUES (_user_id, 'danger', v_title, v_desc, rec.processo_id);
        END IF;
      ELSE
        -- Check milestones: 30, 15, 10, 5, 1
        FOREACH v_milestone IN ARRAY v_milestones LOOP
          IF v_termo_remaining <= v_milestone THEN
            v_title := 'Vencimento Próximo: ' || v_milestone || ' dias';
            v_desc := 'O termo do protocolo ' || rec.prot_numero || ' vence em ' || v_termo_remaining || ' dias.';
            v_tipo := CASE WHEN v_milestone <= 5 THEN 'danger' ELSE 'warning' END;
            
            IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = v_title) THEN
              INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
              VALUES (_user_id, v_tipo, v_title, v_desc, rec.processo_id);
            END IF;
            EXIT; -- Apenas notifica o marco mais próximo atingido
          END IF;
        END LOOP;
      END IF;
    END IF;

    ---------------------------------------------------------
    -- 2. Check 120 days deadline (Expiração Próxima)
    ---------------------------------------------------------
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
        v_title := 'Prazo Expirado';
        v_desc := 'O protocolo ' || rec.prot_numero || ' ultrapassou o limite de retorno de 120 dias.';
        IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = v_title) THEN
          INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
          VALUES (_user_id, 'danger', v_title, v_desc, rec.processo_id);
        END IF;
      ELSE
        -- Check milestones: 30, 15, 10, 5, 1
        FOREACH v_milestone IN ARRAY v_milestones LOOP
          IF v_remaining <= v_milestone THEN
            v_title := 'Expiração Próxima: ' || v_milestone || ' dias';
            v_desc := 'O protocolo ' || rec.prot_numero || ' expira em ' || v_remaining || ' dias.';
            v_tipo := CASE WHEN v_milestone <= 5 THEN 'danger' ELSE 'warning' END;

            IF NOT EXISTS (SELECT 1 FROM public.notificacoes n WHERE n.user_id = _user_id AND n.processo_id = rec.processo_id AND n.titulo = v_title) THEN
              INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
              VALUES (_user_id, v_tipo, v_title, v_desc, rec.processo_id);
            END IF;
            EXIT; -- Apenas notifica o marco mais próximo atingido
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
