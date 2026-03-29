-- Função e Gatilho para Atribuição de Vistoria
CREATE OR REPLACE FUNCTION public.notify_vistoria_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_protocolo_numero TEXT;
BEGIN
  -- Busca o número do protocolo associado à vistoria
  SELECT p.numero INTO v_protocolo_numero
  FROM public.processos proc
  JOIN public.protocolos p ON p.id = proc.protocolo_id
  WHERE proc.id = NEW.processo_id;

  IF NEW.vistoriador_1_id IS NOT NULL AND (OLD.vistoriador_1_id IS NULL OR NEW.vistoriador_1_id <> OLD.vistoriador_1_id) THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
    VALUES (NEW.vistoriador_1_id, 'info', 'Nova Vistoria Atribuída', 'A 1ª vistoria do protocolo ' || v_protocolo_numero || ' foi atribuída a você.', NEW.processo_id);
  END IF;

  IF NEW.vistoriador_2_id IS NOT NULL AND (OLD.vistoriador_2_id IS NULL OR NEW.vistoriador_2_id <> OLD.vistoriador_2_id) THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
    VALUES (NEW.vistoriador_2_id, 'info', 'Nova Vistoria Atribuída', 'A 2ª vistoria do protocolo ' || v_protocolo_numero || ' foi atribuída a você.', NEW.processo_id);
  END IF;

  IF NEW.vistoriador_3_id IS NOT NULL AND (OLD.vistoriador_3_id IS NULL OR NEW.vistoriador_3_id <> OLD.vistoriador_3_id) THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
    VALUES (NEW.vistoriador_3_id, 'info', 'Nova Vistoria Atribuída', 'A 3ª vistoria do protocolo ' || v_protocolo_numero || ' foi atribuída a você.', NEW.processo_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vistoria_assigned ON public.vistorias;
CREATE TRIGGER on_vistoria_assigned
  AFTER UPDATE OF vistoriador_1_id, vistoriador_2_id, vistoriador_3_id
  ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vistoria_assigned();

-- Função e Gatilho para Resultados da Vistoria
CREATE OR REPLACE FUNCTION public.notify_vistoria_result()
RETURNS TRIGGER AS $$
DECLARE
  v_protocolo_numero TEXT;
  v_notif_tipo TEXT;
  v_notif_titulo TEXT;
  v_etapa INT;
  v_status TEXT;
BEGIN
  -- Verifica qual etapa teve o status alterado
  IF NEW.status_1_vistoria IS NOT NULL AND (OLD.status_1_vistoria IS NULL OR NEW.status_1_vistoria <> OLD.status_1_vistoria) THEN
    v_etapa := 1;
    v_status := NEW.status_1_vistoria::TEXT;
  ELSIF NEW.status_2_vistoria IS NOT NULL AND (OLD.status_2_vistoria IS NULL OR NEW.status_2_vistoria <> OLD.status_2_vistoria) THEN
    v_etapa := 2;
    v_status := NEW.status_2_vistoria::TEXT;
  ELSIF NEW.status_3_vistoria IS NOT NULL AND (OLD.status_3_vistoria IS NULL OR NEW.status_3_vistoria <> OLD.status_3_vistoria) THEN
    v_etapa := 3;
    v_status := NEW.status_3_vistoria::TEXT;
  ELSE
    RETURN NEW;
  END IF;

  -- Define o visual da notificação conforme o resultado
  IF v_status = 'aprovado' THEN
    v_notif_tipo := 'success';
    v_notif_titulo := 'Vistoria Aprovada';
  ELSIF v_status = 'reprovado' THEN
    v_notif_tipo := 'danger';
    v_notif_titulo := 'Vistoria Reprovada';
  ELSIF v_status = 'pendencia' THEN
    v_notif_tipo := 'warning';
    v_notif_titulo := 'Vistoria com Pendência';
  END IF;

  -- Busca o número do protocolo
  SELECT p.numero INTO v_protocolo_numero
  FROM public.processos proc
  JOIN public.protocolos p ON p.id = proc.protocolo_id
  WHERE proc.id = NEW.processo_id;

  -- Insere a notificação para todos os administradores e distribuidores
  INSERT INTO public.notificacoes (user_id, tipo, titulo, descricao, processo_id)
  SELECT user_id, v_notif_tipo, v_notif_titulo, 'A ' || v_etapa || 'ª vistoria do protocolo ' || v_protocolo_numero || ' resultou em: ' || upper(v_status), NEW.processo_id
  FROM public.user_roles
  WHERE role IN ('admin', 'distribuidor');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vistoria_result ON public.vistorias;
CREATE TRIGGER on_vistoria_result
  AFTER UPDATE OF status_1_vistoria, status_2_vistoria, status_3_vistoria
  ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vistoria_result();
