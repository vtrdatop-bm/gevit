import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Building2, MapPin, FileText, Pencil, X, Save, LocateFixed, Loader2, Plus, Search, Trash2, AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VistoriaTab from "@/components/protocolo/VistoriaTab";
import ExpirationWarning from "@/components/protocolo/ExpirationWarning";
import { cn, formatProtocoloNumero, formatArea, applyAreaMask, parseAreaToNumber, formatAreaOnBlur, formatCpfCnpj, getCpfCnpjLabel, formatCep, truncateCoordinate } from "@/lib/utils";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";
import { computeDisplayStatus, computeStage, sortVistoriadores } from "@/lib/vistoriaStatus";
import { Vistoriador } from "@/types/user";
import { useAuth } from "@/hooks/useAuth";

import { ProtocoloData, VistoriaData, ProcessoData, TermoData } from "@/types/database";
import { DETAIL_MOCK_DATA } from "@/mocks/mockData";


export default function ProtocoloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDev } = useAuth();
  const [protocolo, setProtocolo] = useState<ProtocoloData | null>(null);
  const [processo, setProcesso] = useState<ProcessoData | null>(null);
  const [vistoria, setVistoria] = useState<VistoriaData | null>(null);
  const [termo, setTermo] = useState<TermoData | null>(null);
  const [pausas, setPausas] = useState<{ id: string; data_inicio: string; data_fim: string | null; etapa: string; motivo: string | null }[]>([]);
  const [vistoriadores, setVistoriadores] = useState<Vistoriador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [municipios, setMunicipios] = useState<{ id: string; nome: string }[]>([]);
  const [bairros, setBairros] = useState<{ id: string; nome: string; municipio: string }[]>([]);
  const [regionais, setRegionais] = useState<{ id: string; nome: string }[]>([]);
  const [regionaisMunicipios, setRegionaisMunicipios] = useState<{ regional_id: string; municipio_id: string }[]>([]);
  const [bairroSearch, setBairroSearch] = useState("");
  const [bairroDropdownOpen, setBairroDropdownOpen] = useState(false);
  const [savingBairro, setSavingBairro] = useState(false);
  const [novoBairroDialog, setNovoBairroDialog] = useState(false);
  const [novoBairroNome, setNovoBairroNome] = useState("");
  const [novoBairroRegional, setNovoBairroRegional] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const lastCnpjSearched = useRef<string>("");
  const bairroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bairroRef.current && !bairroRef.current.contains(e.target as Node)) {
        setBairroDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const bairrosFiltrados = useMemo(
    () => editForm.municipio ? bairros.filter((b) => b.municipio === editForm.municipio) : [],
    [bairros, editForm.municipio]
  );

  const bairrosFiltered = useMemo(() => {
    if (!bairroSearch) return bairrosFiltrados;
    const q = bairroSearch.toLowerCase();
    return bairrosFiltrados.filter((b) => b.nome.toLowerCase().includes(q));
  }, [bairrosFiltrados, bairroSearch]);

  const regionaisFiltradas = useMemo(() => {
    if (!editForm.municipio) return [];
    const mun = municipios.find((m) => m.nome === editForm.municipio);
    if (!mun) return [];
    const regionalIds = regionaisMunicipios
      .filter((rm) => rm.municipio_id === mun.id)
      .map((rm) => rm.regional_id);
    return regionais.filter((r) => regionalIds.includes(r.id));
  }, [editForm.municipio, municipios, regionaisMunicipios, regionais]);

  const bairroNotFound = bairroSearch.length > 0 && bairrosFiltered.length === 0 && editForm.municipio;

  const initialLoadRef = useRef(true);
  const fetchData = useCallback(async () => {
    if (!id) return;
    if (initialLoadRef.current) {
      setLoading(true);
      initialLoadRef.current = false;
    }

    if (isDev) {
      setProtocolo(DETAIL_MOCK_DATA.protocolo);
      setMunicipios(DETAIL_MOCK_DATA.municipios);
      setBairros(DETAIL_MOCK_DATA.bairros);
      setRegionais(DETAIL_MOCK_DATA.regionais);
      setVistoriadores(DETAIL_MOCK_DATA.vistoriadores);
      setProcesso(DETAIL_MOCK_DATA.processo);
      setVistoria(DETAIL_MOCK_DATA.vistoria as any);
      setLoading(false);
      return;
    }

    const [{ data: prot }, { data: procs }, { data: muns }, { data: bairs }, { data: regs }, { data: regMuns }] = await Promise.all([
      supabase.from("protocolos").select("*").eq("id", id).single(),
      supabase.from("processos").select("*").eq("protocolo_id", id),
      supabase.from("municipios").select("id, nome").order("nome"),
      supabase.from("bairros").select("id, nome, municipio").order("nome"),
      supabase.from("regionais").select("id, nome").order("nome"),
      supabase.from("regionais_municipios").select("regional_id, municipio_id"),
    ]);

    setProtocolo(prot);
    setMunicipios(muns || []);
    setBairros(bairs || []);
    setRegionais(regs || []);
    setRegionaisMunicipios(regMuns || []);

    const { data: vRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "vistoriador");

    if (vRoles && vRoles.length > 0) {
      const vistoriadorUserIds = vRoles.map((r: any) => r.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, patente, nome_guerra")
        .in("user_id", vistoriadorUserIds);
      
      if (profErr) {
        console.error("Erro ao carregar perfis de vistoriadores:", profErr.message);
      }
      setVistoriadores(sortVistoriadores(profiles || []));
    } else if (rolesErr) {
      console.error("Erro ao carregar papéis de vistoriadores:", rolesErr.message);
    }

    if (procs && procs.length > 0) {
      const proc = procs[0];
      setProcesso(proc);

      const [vistRes, termoRes, pausasRes] = await Promise.all([
        supabase.from("vistorias").select("*").eq("processo_id", proc.id).maybeSingle(),
        supabase.from("termos_compromisso").select("*").eq("processo_id", proc.id).maybeSingle(),
        supabase.from("pausas").select("*").eq("processo_id", proc.id).order("data_inicio"),
      ]);

      let finalVistData = vistRes.data;
      if (!finalVistData) {
        const { data: createdVist } = await supabase
          .from("vistorias")
          .insert({ processo_id: proc.id })
          .select()
          .single();
        finalVistData = createdVist;
      }
      setVistoria(finalVistData as any);
      setTermo(termoRes.data);
      setPausas(pausasRes.data || []);
    } else {
      const { data: newProc } = await supabase
        .from("processos")
        .insert({ protocolo_id: id })
        .select()
        .single();
      if (newProc) {
        setProcesso(newProc);
        const { data: newVist } = await supabase
          .from("vistorias")
          .insert({ processo_id: newProc.id })
          .select()
          .single();
        setVistoria(newVist);
      }
    }

    setLoading(false);
  }, [id, isDev]);

  const dStatus = useMemo(() => {
    return computeDisplayStatus(processo?.status || "regional", vistoria, protocolo?.data_solicitacao);
  }, [processo?.status, vistoria, protocolo?.data_solicitacao]);

  const stage = useMemo(() => {
    return computeStage(vistoria);
  }, [vistoria]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`protocolo-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "processos", filter: `protocolo_id=eq.${id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "vistorias" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "termos_compromisso" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchData, isDev]);

  useEffect(() => {
    if (protocolo && !editing) {
      const cnpjDigits = (protocolo.cnpj || "").replace(/\D/g, "");
      lastCnpjSearched.current = cnpjDigits;

      setEditForm({
        numero: protocolo.numero,
        data_solicitacao: protocolo.data_solicitacao,
        cnpj: formatCpfCnpj(protocolo.cnpj),
        razao_social: protocolo.razao_social,
        nome_fantasia: protocolo.nome_fantasia || "",
        endereco: protocolo.endereco,
        bairro: (protocolo.bairro || "").toUpperCase(),
        municipio: (protocolo.municipio || "").toUpperCase(),
        area: protocolo.area ? formatArea(protocolo.area) : "",
        cep: formatCep(protocolo.cep) || "",
        latitude: truncateCoordinate(protocolo.latitude?.toString() || ""),
        longitude: truncateCoordinate(protocolo.longitude?.toString() || ""),
      });
    }
  }, [protocolo, editing]);

  const startEdit = () => {
    if (!protocolo) return;
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!protocolo) return;
    setSaving(true);

    if (!editForm.nome_fantasia || !editForm.nome_fantasia.trim()) {
      toast.error("O campo Nome Fantasia é obrigatório");
      setSaving(false);
      return;
    }
    if (!editForm.cep || !editForm.cep.trim()) {
      toast.error("O campo CEP é obrigatório");
      setSaving(false);
      return;
    }
    if (!editForm.area || !editForm.area.trim()) {
      toast.error("O campo Área é obrigatório");
      setSaving(false);
      return;
    }

    const cnpjClean = (editForm.cnpj || "").replace(/\D/g, "");
    if (cnpjClean.length !== 11 && cnpjClean.length !== 14) {
      toast.error("CPF/CNPJ inválido — deve conter 11 ou 14 dígitos");
      setSaving(false);
      return;
    }
    const { data: updated, error } = await supabase.from("protocolos").update({
      numero: editForm.numero,
      data_solicitacao: editForm.data_solicitacao,
      cnpj: cnpjClean,
      razao_social: editForm.razao_social,
      nome_fantasia: editForm.nome_fantasia || null,
      endereco: editForm.endereco,
      bairro: (editForm.bairro || "").toUpperCase(),
      municipio: (editForm.municipio || "").toUpperCase(),
      area: editForm.area ? parseAreaToNumber(editForm.area) : null,
      cep: editForm.cep ? editForm.cep.replace(/\D/g, "") : null,
      latitude: editForm.latitude ? parseFloat(String(editForm.latitude).replace(",", ".")) : null,
      longitude: editForm.longitude ? parseFloat(String(editForm.longitude).replace(",", ".")) : null,
    }).eq("id", protocolo.id).select();

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else if (!updated || updated.length === 0) {
      toast.error("Não foi possível salvar — sem permissão ou registro não encontrado");
    } else {
      toast.success("Protocolo atualizado!");
      setEditing(false);
      await fetchData();
    }
    setSaving(false);
  };

  const handleEditChange = (key: string, value: string) => {
    let finalValue = value;
    if (key === "municipio" || key === "bairro") finalValue = value.toUpperCase();
    if (key === "area") finalValue = applyAreaMask(value);

    setEditForm((prev) => {
      const next = { ...prev, [key]: finalValue };
      if (key === "municipio") {
        next.bairro = "";
        setBairroSearch("");
      }
      return next;
    });
  };

  const lookupCnpj = useCallback(async (cnpjDigits: string, quiet = false) => {
    if (cnpjDigits.length !== 14 || (quiet && cnpjDigits === lastCnpjSearched.current)) return;
    
    lastCnpjSearched.current = cnpjDigits;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("CNPJ não encontrado na Receita Federal");
        } else if (!quiet) {
          toast.error("Erro no servidor da Receita Federal. Tente novamente em instantes.");
        }
        setCnpjLoading(false);
        return;
      }
      const data = await res.json();
      const numero = data.numero || "";
      const complemento = data.complemento || "";
      const logradouro = data.descricao_tipo_de_logradouro
        ? `${data.descricao_tipo_de_logradouro} ${data.logradouro}`
        : data.logradouro || "";
      const enderecoCompleto = [logradouro, numero ? `nº ${numero}` : "", complemento].filter(Boolean).join(", ");

      setEditForm((prev) => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social || "",
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia || "",
        endereco: enderecoCompleto || prev.endereco || "",
        bairro: (data.bairro || prev.bairro || "").toUpperCase(),
        municipio: (data.municipio || prev.municipio || "").toUpperCase(),
        cep: data.cep ? formatCep(data.cep.toString().replace(/\D/g, "")) : prev.cep || "",
      }));
      if (!quiet) toast.success("Dados do CNPJ preenchidos!");
    } catch {
      if (!quiet) {
        toast.error("Erro ao completar a busca do CNPJ.");
      }
    } finally {
      setCnpjLoading(false);
    }
  }, []);

  useEffect(() => {
    const digits = (editForm.cnpj || "").replace(/\D/g, "");
    if (digits.length === 14 && digits !== lastCnpjSearched.current) {
      const timer = setTimeout(() => {
        lookupCnpj(digits, true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [editForm.cnpj, lookupCnpj]);

  const openNovoBairroDialog = (nome: string) => {
    setNovoBairroNome(nome);
    setNovoBairroRegional("");
    setBairroDropdownOpen(false);
    setNovoBairroDialog(true);
  };

  const saveNovoBairro = async () => {
    const nome = novoBairroNome.trim().toUpperCase();
    if (!editForm.municipio || !nome) return;
    setSavingBairro(true);
    const { error } = await supabase.from("bairros").insert({
      nome,
      municipio: (editForm.municipio || "").toUpperCase(),
      regional_id: novoBairroRegional || null,
    });
    if (error) {
      toast.error("Erro ao cadastrar bairro: " + error.message);
    } else {
      const { data: newBairros } = await supabase.from("bairros").select("id, nome, municipio").order("nome");
      setBairros(newBairros || []);
      handleEditChange("bairro", nome);
      setBairroSearch("");
      setNovoBairroDialog(false);
      toast.success(`Bairro "${nome}" cadastrado!`);
    }
    setSavingBairro(false);
  };

  const geocodeAddress = async () => {
    setGeocoding(true);
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!googleApiKey) {
      toast.error("Chave do Google Maps não configurada");
      setGeocoding(false);
      return;
    }

    try {
      const endereco = editForm.endereco || "";
      const municipioStr = editForm.municipio || "";
      const bairroStr = editForm.bairro || "";
      const cep = editForm.cep || "";

      // Estratégias de busca (do mais específico para o mais genérico)
      const strategies = [
        [endereco, bairroStr, municipioStr, "Acre", cep, "Brasil"].filter(Boolean).join(", "),
        [endereco, municipioStr, "Acre"].filter(Boolean).join(", "),
        [cep, "Brasil"].filter(Boolean).join(", ")
      ].filter((v, i, a) => a.indexOf(v) === i); // remover duplicatas

      let foundResult = null;

      for (const query of strategies) {
        // Adicionar filtros de componente para travar o país e estado
        // E tentar travar a localidade (município) se disponível
        const components: string[] = ["country:BR", "administrative_area:AC"];
        if (municipioStr) {
          components.push(`locality:${municipioStr}`);
        }

        const componentStr = encodeURIComponent(components.join("|"));
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=${componentStr}&key=${googleApiKey}&language=pt-BR`
        );
        const data = await response.json();

        if (data.status === "OK" && data.results.length > 0) {
          const result = data.results[0];
          
          // Validação extra: Verificamos se o resultado não fugiu demais da cidade solicitada
          const resultLocality = result.address_components.find((c: any) => 
            c.types.includes("locality") || c.types.includes("administrative_area_level_2")
          )?.long_name || "";

          // Se pedimos Acrelândia e veio Rio Branco, por exemplo, ignoramos se for muito discrepante
          if (municipioStr && resultLocality) {
            const mRequested = municipioStr.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const mFound = resultLocality.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            // Se as cidades não batem, desconsideramos este resultado técnico e tentamos a próxima estratégia
            if (!mFound.includes(mRequested) && !mRequested.includes(mFound)) {
              console.warn(`Localidade divergente: Pedido ${mRequested}, Recebido ${mFound}`);
              continue;
            }
          }

          foundResult = result;
          break;
        } else if (data.status !== "ZERO_RESULTS" && data.status !== "OK") {
          console.error("Google Geocoding API Error:", data.status, data.error_message);
          let userMsg = "Erro na busca do Google";
          if (data.status === "REQUEST_DENIED") {
            userMsg = "Acesso Negado: Ative a 'Geocoding API' no Google Cloud Console.";
          }
          toast.error(userMsg);
          setGeocoding(false);
          return;
        }
      }

      if (foundResult) {
        const { lat, lng } = foundResult.geometry.location;
        const finalLat = lat.toFixed(6);
        const finalLon = lng.toFixed(6);

        setEditForm(prev => ({
          ...prev,
          latitude: finalLat,
          longitude: finalLon
        }));

        if (protocolo) {
          const { error: protError } = await supabase
            .from("protocolos")
            .update({
              latitude: lat,
              longitude: lng,
            })
            .eq("id", id);

          if (protError) {
            console.error("Erro ao salvar no banco:", protError);
            toast.error("Localizado, mas erro ao salvar no banco");
          } else {
            toast.success("Localizado com precisão na cidade correta!");
          }
        }
      } else {
        toast.error("Local não encontrado na cidade solicitada");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      toast.error("Erro ao conectar com o Google Maps");
    } finally {
      setGeocoding(false);
    }
  };



  const handleDeleteProtocolo = async () => {
    if (!protocolo) return;
    setIsDeleting(true);
    try {
      if (processo) {
        await Promise.all([
          supabase.from("notificacoes").delete().eq("processo_id", processo.id),
          supabase.from("vistorias").delete().eq("processo_id", processo.id),
          supabase.from("pausas").delete().eq("processo_id", processo.id),
          supabase.from("termos_compromisso").delete().eq("processo_id", processo.id),
        ]);
        const { error: errProc } = await supabase.from("processos").delete().eq("id", processo.id);
        if (errProc) throw errProc;
      }
      const { error } = await supabase.from("protocolos").delete().eq("id", protocolo.id);
      if (error) throw error;
      toast.success("Protocolo excluído com sucesso");
      navigate("/protocolos");
    } catch (error: any) {
      toast.error("Erro ao excluir protocolo: " + error.message);
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCpfCnpjInput = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const inputClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!protocolo) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Protocolo não encontrado.</p>
        <button onClick={() => navigate("/protocolos")} className="text-primary hover:underline mt-2 text-sm">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-foreground">{protocolo.numero}</h2>
            <div className="flex items-center gap-2">
              <StatusBadge status={dStatus} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Solicitado em {new Date(protocolo.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}
          </p>
        </div>
        {!editing ? (
          <div className="flex gap-2 ml-auto sm:ml-0">
            <button onClick={() => setDeleteDialogOpen(true)} className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors whitespace-nowrap">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
            <button onClick={startEdit} className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors whitespace-nowrap">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          </div>
        ) : (
          <div className="flex gap-2 ml-auto sm:ml-0">
            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors whitespace-nowrap">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap">
              <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            Empresa
          </div>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="numero" className="text-sm font-medium">Nº Protocolo</label>
                <input id="numero" value={editForm.numero || ""} onChange={(e) => handleEditChange("numero", formatProtocoloNumero(e.target.value))} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="data_solicitacao" className="text-sm font-medium">Data Solicitação</label>
                <input id="data_solicitacao" type="date" value={editForm.data_solicitacao || ""} onChange={(e) => handleEditChange("data_solicitacao", e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cnpj" className="text-sm font-medium">CPF/CNPJ</label>
                <div className="flex gap-2 overflow-hidden">
                  <input id="cnpj" value={editForm.cnpj || ""} onChange={(e) => handleEditChange("cnpj", formatCpfCnpjInput(e.target.value))} className={cn(inputClass, "min-w-0")} />
                  <button type="button" onClick={() => lookupCnpj((editForm.cnpj || "").replace(/\D/g, ""))} disabled={cnpjLoading || (editForm.cnpj || "").replace(/\D/g, "").length !== 14} className="flex items-center justify-center px-3 h-9 rounded-md border border-input hover:bg-accent transition-colors disabled:opacity-50 shrink-0">
                    {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="razao_social" className="text-sm font-medium">Razão Social</label>
                <input id="razao_social" value={editForm.razao_social || ""} onChange={(e) => handleEditChange("razao_social", e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="nome_fantasia" className="text-sm font-medium">Nome Fantasia</label>
                <input id="nome_fantasia" value={editForm.nome_fantasia || ""} onChange={(e) => handleEditChange("nome_fantasia", e.target.value)} className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{protocolo.nome_fantasia || protocolo.razao_social}</p>
              {protocolo.nome_fantasia && <p className="text-muted-foreground text-xs">{protocolo.razao_social}</p>}
              <p className="text-muted-foreground font-mono text-xs">
                {getCpfCnpjLabel(protocolo.cnpj)}: {formatCpfCnpj(protocolo.cnpj)}
              </p>
            </div>
          )}
        </div>
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            Localização
          </div>
          {editing ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <label htmlFor="cep" className="text-xs text-muted-foreground">CEP</label>
                <input id="cep" value={editForm.cep || ""} onChange={(e) => handleEditChange("cep", formatCep(e.target.value))} placeholder="00000-000" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label htmlFor="endereco" className="text-xs text-muted-foreground">Endereço</label>
                <input id="endereco" value={editForm.endereco || ""} onChange={(e) => handleEditChange("endereco", e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label htmlFor="municipio" className="text-xs text-muted-foreground">Município</label>
                <select id="municipio" value={editForm.municipio || ""} onChange={(e) => handleEditChange("municipio", e.target.value)} className={inputClass}>
                  <option value="">Selecione</option>
                  {municipios.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1 relative" ref={bairroRef}>
                <label htmlFor="bairro" className="text-xs text-muted-foreground">Bairro</label>
                <input id="bairro" value={bairroDropdownOpen ? bairroSearch : (editForm.bairro || "")} onChange={(e) => { setBairroSearch(e.target.value); if (!bairroDropdownOpen) setBairroDropdownOpen(true); }} onFocus={() => { setBairroSearch(editForm.bairro || ""); setBairroDropdownOpen(true); }} placeholder={editForm.municipio ? "Digite para buscar..." : "Selecione o município primeiro"} disabled={!editForm.municipio} className={cn(inputClass, !editForm.municipio && "opacity-50")} />
                {bairroDropdownOpen && editForm.municipio && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {bairrosFiltered.map((b) => (
                      <button key={b.id} type="button" onClick={() => { handleEditChange("bairro", b.nome); setBairroSearch(""); setBairroDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">
                        {b.nome}
                      </button>
                    ))}
                    {bairroNotFound && (
                      <button type="button" onClick={() => openNovoBairroDialog(bairroSearch)} disabled={savingBairro} className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-1.5 border-t border-border">
                        <Plus className="w-3.5 h-3.5" />
                        {savingBairro ? "Cadastrando..." : `Cadastrar "${bairroSearch}"`}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="area" className="text-xs text-muted-foreground">Área (m²)</label>
                <input
                  id="area"
                  value={editForm.area || ""}
                  onChange={(e) => handleEditChange("area", e.target.value)}
                  onBlur={(e) => { if (e.target.value) handleEditChange("area", formatAreaOnBlur(e.target.value)); }}
                  className={inputClass}
                  placeholder="Ex: 1.234,56"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="latitude" className="text-xs text-muted-foreground">Latitude</label>
                  <input
                    id="latitude"
                    value={editForm.latitude || ""}
                    onChange={(e) => handleEditChange("latitude", truncateCoordinate(e.target.value.replace(",", ".")))}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text.includes(",")) {
                        e.preventDefault();
                        const [lat, lng] = text.split(",").map(s => s.trim());
                        if (lat && lng) {
                          handleEditChange("latitude", truncateCoordinate(lat));
                          handleEditChange("longitude", truncateCoordinate(lng));
                        }
                      }
                    }}
                    placeholder="-9.975403"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="longitude" className="text-xs text-muted-foreground">Longitude</label>
                  <input
                    id="longitude"
                    value={editForm.longitude || ""}
                    onChange={(e) => handleEditChange("longitude", truncateCoordinate(e.target.value.replace(",", ".")))}
                    placeholder="-67.842870"
                    className={inputClass}
                  />
                </div>
              </div>
              <button type="button" onClick={geocodeAddress} disabled={geocoding || (!editForm.cep && (!editForm.endereco || !editForm.municipio))} className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-input text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 w-full justify-center">
                {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                {geocoding ? "Buscando..." : "Buscar coordenadas"}
              </button>
              {(editForm.latitude && editForm.longitude) && (
                <button type="button" onClick={() => navigate("/mapa", { state: { focusProcessoId: processo?.id } })} className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-input text-xs font-medium hover:bg-accent transition-colors w-full justify-center text-primary">
                  <MapPin className="w-3.5 h-3.5" />
                  Abrir no mapa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {protocolo.cep && <p className="text-muted-foreground text-xs">CEP: {formatCep(protocolo.cep)}</p>}
              <p>{protocolo.endereco}</p>
              <p className="text-muted-foreground">{protocolo.bairro} — {protocolo.municipio}</p>
              {protocolo.area && <p className="text-muted-foreground">Área: {formatArea(protocolo.area)} m²</p>}
              {protocolo.latitude && protocolo.longitude && (
                <>
                  <p className="text-muted-foreground text-xs font-mono">📍 {Number(protocolo.latitude).toFixed(6)}, {Number(protocolo.longitude).toFixed(6)}</p>
                  <button onClick={() => navigate("/mapa", { state: { focusProcessoId: processo?.id } })} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                    <MapPin className="w-3 h-3" />
                    Abrir no mapa
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {processo && vistoria && (
        <ExpirationWarning
          vistoria={vistoria}
          pausas={pausas}
          processoId={processo.id}
          displayStatus={dStatus}
          termoValidade={termo?.data_validade || null}
          onUpdate={fetchData}
        />
      )}

      {processo && vistoria && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            Vistorias
          </div>
          <Tabs defaultValue="vistoria1">
            <TabsList className="w-full grid grid-cols-3">
              {[1, 2, 3].map((n) => {
                const stVist = (vistoria as any)?.[`status_${n}_vistoria`];
                let dotColor = "bg-muted-foreground/30";
                if (stVist === "pendencia") dotColor = "bg-[hsl(var(--status-pending))]";
                else if (stVist === "aprovado") dotColor = "bg-[hsl(var(--status-certified-term))]";
                else if (stVist === "reprovado") dotColor = "bg-[hsl(var(--status-certified))]";
                else if ((vistoria as any)?.[`data_${n}_atribuicao`]) dotColor = "bg-[hsl(var(--status-assigned))]";
                return (
                  <TabsTrigger key={n} value={`vistoria${n}`} className="flex items-center gap-1.5 data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary border-2 border-transparent py-2 shadow-none transition-all text-[10px] xs:text-xs sm:text-sm">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="truncate">{n}ª Vistoria</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {[1, 2, 3].map((n) => (
              <TabsContent key={n} value={`vistoria${n}`} className="mt-4 p-4 border-2 border-primary/20 rounded-xl bg-primary/[0.02]">
                <VistoriaTab
                  numero={n}
                  dataSolicitacao={protocolo.data_solicitacao}
                  dataVistoria={(vistoria as any)?.[`data_${n}_vistoria`]}
                  statusVistoria={(vistoria as any)?.[`status_${n}_vistoria`]}
                  dataRetorno={(vistoria as any)?.[`data_${n === 1 ? 1 : n - 1}_retorno`]}
                  vistoriadorId={(vistoria as any)?.[`vistoriador_${n}_id`]}
                  vistoriadores={vistoriadores}
                  processoId={processo.id}
                  vistoriaId={vistoria?.id}
                  dataAtribuicao={(vistoria as any)?.[`data_${n}_atribuicao`]}
                  termo={termo}
                  onUpdate={fetchData}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      <Dialog open={novoBairroDialog} onOpenChange={setNovoBairroDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cadastrar novo bairro</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Município</label>
              <input value={editForm.municipio || ""} disabled className={cn(inputClass, "opacity-60")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome do Bairro</label>
              <input value={novoBairroNome} onChange={(e) => setNovoBairroNome(e.target.value)} placeholder="Digite o nome do bairro" className={inputClass} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Regional</label>
              <select value={novoBairroRegional} onChange={(e) => setNovoBairroRegional(e.target.value)} className={inputClass}>
                <option value="">Selecione a regional</option>
                {regionaisFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setNovoBairroDialog(false)} className="px-4 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={saveNovoBairro} disabled={savingBairro || !novoBairroNome.trim()} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                <Save className="w-3.5 h-3.5" /> {savingBairro ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="w-5 h-5" />Confirmar Exclusão</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground">Você tem certeza que deseja excluir o protocolo **{protocolo.numero}**?</p>
            <p className="text-xs text-muted-foreground p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-destructive-foreground">Esta ação é permanente e excluirá também todas as vistorias, documentos e históricos associados a este protocolo.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting} className="px-4 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors">Cancelar</button>
            <button onClick={handleDeleteProtocolo} disabled={isDeleting} className="px-4 h-9 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" />Excluindo...</> : "Sim, Excluir"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
