import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Building2, MapPin, FileText, Pencil, X, Save, LocateFixed, Loader2, Plus, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VistoriaTab from "@/components/protocolo/VistoriaTab";
import ExpirationWarning from "@/components/protocolo/ExpirationWarning";
import { cn, formatProtocoloNumero, formatArea, applyAreaMask, parseAreaToNumber } from "@/lib/utils";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";
import { computeDisplayStatus, computeStage } from "@/lib/vistoriaStatus";
import { Vistoriador } from "@/types/user";
import { useCallback } from "react";

interface ProtocoloData {
  id: string;
  numero: string;
  data_solicitacao: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  endereco: string;
  bairro: string;
  municipio: string;
  area: number | null;
  latitude: number | null;
  longitude: number | null;
  cep: string | null;
  solicitante: string | null;
  tipo_empresa: string | null;
  tipo_servico: string | null;
}

interface VistoriaData {
  id: string;
  processo_id: string;
  data_1_vistoria: string | null;
  status_1_vistoria: string | null;
  data_1_retorno: string | null;
  data_2_vistoria: string | null;
  status_2_vistoria: string | null;
  data_2_retorno: string | null;
  data_3_vistoria: string | null;
  status_3_vistoria: string | null;
  vistoriador_1_id: string | null;
  vistoriador_2_id: string | null;
  vistoriador_3_id: string | null;
  observacoes: string | null;
}

interface ProcessoData {
  id: string;
  protocolo_id: string;
  status: string;
  regional_id: string | null;
  vistoriador_id: string | null;
  data_prevista: string | null;
}

// interface Vistoriador moved to @/types/user

interface TermoData {
  id: string;
  processo_id: string;
  numero_termo: string;
  data_assinatura: string;
  data_validade: string;
}

const formatCpfCnpj = (val: string) => {
  if (val.length === 11) return val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (val.length === 14) return val.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return val;
};

export default function ProtocoloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [cnpjLoading, setCnpjLoading] = useState(false);
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

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [{ data: prot }, { data: procs }, { data: vistoriasRoles }, { data: muns }, { data: bairs }, { data: regs }, { data: regMuns }] = await Promise.all([
      supabase.from("protocolos").select("*").eq("id", id).single(),
      supabase.from("processos").select("*").eq("protocolo_id", id),
      supabase.from("user_roles").select("user_id").eq("role", "vistoriador"),
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

    // Load vistoriadores profiles
    if (vistoriasRoles && vistoriasRoles.length > 0) {
      const userIds = vistoriasRoles.map((v: any) => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, patente, nome_guerra")
        .in("user_id", userIds);
      setVistoriadores(profiles || []);
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
      // Create processo automatically
      const { data: newProc } = await supabase
        .from("processos")
        .insert({ protocolo_id: id })
        .select()
        .single();
      if (newProc) {
        setProcesso(newProc);
        // Create vistoria record
        const { data: newVist } = await supabase
          .from("vistorias")
          .insert({ processo_id: newProc.id })
          .select()
          .single();
        setVistoria(newVist);
      }
    }

    setLoading(false);
  }, [id]);

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
  }, [id, fetchData]);

  const startEdit = () => {
    if (!protocolo) return;
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
      cep: protocolo.cep || "",
      latitude: protocolo.latitude?.toString() || "",
      longitude: protocolo.longitude?.toString() || "",
      solicitante: protocolo.solicitante || "",
      tipo_empresa: protocolo.tipo_empresa || "",
      tipo_servico: protocolo.tipo_servico || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!protocolo) return;
    setSaving(true);
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
      solicitante: editForm.solicitante || null,
      tipo_empresa: editForm.tipo_empresa || null,
      tipo_servico: editForm.tipo_servico || null,
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

  const lookupCnpj = async (cnpjDigits: string) => {
    if (cnpjDigits.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
      if (!res.ok) {
        toast.error("CNPJ não encontrado na Receita Federal");
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
      toast.success("Dados do CNPJ preenchidos!");
    } catch {
      toast.error("Erro ao consultar CNPJ");
    }
    setCnpjLoading(false);
  };

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


  const formatCep = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.replace(/(\d{2})(\d)/, "$1.$2");
    return digits.replace(/(\d{2})(\d{3})(\d)/, "$1.$2-$3");
  };

  const geocodeAddress = async () => {
    setGeocoding(true);
    let viaCepData: any = null;
    try {
      const cepClean = (editForm.cep || "").replace(/\D/g, "");
      const endereco = editForm.endereco || "";
      const numMatch = endereco.match(/(\d+)\s*$/);
      const numero = numMatch ? numMatch[1] : "";

      let lat: string | null = null;
      let lon: string | null = null;

      if (cepClean.length === 8) {
        try {
          const viaCepRes = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
          viaCepData = await viaCepRes.json();
          const viaCep = viaCepData;

          if (viaCep && !viaCep.erro && viaCep.logradouro) {
            const parts = [
              numero ? `${viaCep.logradouro}, ${numero}` : viaCep.logradouro,
              viaCep.bairro,
              viaCep.localidade,
              viaCep.uf,
              "Brasil",
            ].filter(Boolean);
            const addr = parts.join(", ");

            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`,
              { headers: { "User-Agent": "GEVIT-App/1.0" } }
            );
            const data = await res.json();
            if (data && data.length > 0) {
              lat = parseFloat(data[0].lat).toFixed(6);
              lon = parseFloat(data[0].lon).toFixed(6);
            }
          }
        } catch { /* fallback */ }
      }

      if (!lat || !lon) {
        const addr = `${endereco}, ${editForm.bairro}, ${editForm.municipio}, Acre, Brasil`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`,
          { headers: { "User-Agent": "GEVIT-App/1.0" } }
        );
        const data = await res.json();
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat).toFixed(6);
          lon = parseFloat(data[0].lon).toFixed(6);
        }
      }

      if (lat && lon) {
        setEditForm((prev) => ({
          ...prev,
          latitude: lat!,
          longitude: lon!,
          // Also update address if it was empty
          bairro: prev.bairro || (viaCepData?.bairro?.toUpperCase() || ""),
          municipio: prev.municipio || (viaCepData?.localidade?.toUpperCase() || ""),
        }));

        // Save coordinates immediately to DB
        if (protocolo) {
      const cepClean = (editForm.cep || "").replace(/\D/g, "");
      const { error: protError } = await supabase
        .from("protocolos")
        .update({
          razao_social: editForm.razao_social,
          nome_fantasia: editForm.nome_fantasia || null,
          endereco: editForm.endereco,
          // numero: editForm.numero, // 'numero' field not in ProtocoloData for address number
          bairro: editForm.bairro,
          municipio: editForm.municipio,
          cep: cepClean || null,
          area: parseAreaToNumber(editForm.area),
          latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
          longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
          solicitante: editForm.solicitante || null,
          tipo_empresa: editForm.tipo_empresa || null,
          tipo_servico: editForm.tipo_servico || null,
        })
        .eq("id", id);
        }

        toast.success("Coordenadas encontradas e salvas!");
      } else {
        toast.error("Endereço não encontrado no mapa");
      }
    } catch {
      toast.error("Erro ao buscar coordenadas");
    }
    setGeocoding(false);
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
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/protocolos")}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-foreground">{protocolo.numero}</h2>
            {processo && (
              <StatusBadge
                status={computeDisplayStatus(processo.status, vistoria ? {
                  data_1_atribuicao: (vistoria as any).data_1_atribuicao,
                  data_2_atribuicao: (vistoria as any).data_2_atribuicao,
                  data_3_atribuicao: (vistoria as any).data_3_atribuicao,
                  data_1_vistoria: vistoria.data_1_vistoria,
                  data_2_vistoria: vistoria.data_2_vistoria,
                  data_3_vistoria: vistoria.data_3_vistoria,
                  status_1_vistoria: vistoria.status_1_vistoria,
                  status_2_vistoria: vistoria.status_2_vistoria,
                  status_3_vistoria: vistoria.status_3_vistoria,
                  data_1_retorno: vistoria.data_1_retorno,
                  data_2_retorno: vistoria.data_2_retorno,
                } : null)}
                stage={computeStage(vistoria ? {
                  data_1_atribuicao: (vistoria as any).data_1_atribuicao,
                  data_2_atribuicao: (vistoria as any).data_2_atribuicao,
                  data_3_atribuicao: (vistoria as any).data_3_atribuicao,
                  data_1_vistoria: vistoria.data_1_vistoria,
                  data_2_vistoria: vistoria.data_2_vistoria,
                  data_3_vistoria: vistoria.data_3_vistoria,
                  status_1_vistoria: vistoria.status_1_vistoria,
                  status_2_vistoria: vistoria.status_2_vistoria,
                  status_3_vistoria: vistoria.status_3_vistoria,
                  data_1_retorno: vistoria.data_1_retorno,
                  data_2_retorno: vistoria.data_2_retorno,
                } : null)}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Solicitado em {new Date(protocolo.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}
          </p>
        </div>
        {!editing ? (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}
      </div>

      {/* Info cards */}
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
                <div className="flex gap-2">
                  <input
                    id="cnpj"
                    value={editForm.cnpj || ""}
                    onChange={(e) => {
                      const formatted = formatCpfCnpjInput(e.target.value);
                      handleEditChange("cnpj", formatted);
                      const digits = formatted.replace(/\D/g, "");
                      if (digits.length === 14) lookupCnpj(digits);
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => lookupCnpj((editForm.cnpj || "").replace(/\D/g, ""))}
                    disabled={cnpjLoading || (editForm.cnpj || "").replace(/\D/g, "").length !== 14}
                    title="Buscar dados do CNPJ"
                    className="flex items-center justify-center px-3 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
                  >
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
              <div className="space-y-1.5">
                <label htmlFor="solicitante" className="text-sm font-medium">Solicitante</label>
                <input id="solicitante" value={editForm.solicitante || ""} onChange={(e) => handleEditChange("solicitante", e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tipo_empresa" className="text-sm font-medium">Tipo de Empresa</label>
                <select id="tipo_empresa" value={editForm.tipo_empresa || ""} onChange={(e) => handleEditChange("tipo_empresa", e.target.value)} className={inputClass}>
                  <option value="">Selecione</option>
                  <option value="Pessoa Física">Pessoa Física</option>
                  <option value="Pessoa Jurídica">Pessoa Jurídica</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tipo_servico" className="text-sm font-medium">Tipo de Serviço</label>
                <input id="tipo_servico" value={editForm.tipo_servico || ""} onChange={(e) => handleEditChange("tipo_servico", e.target.value)} className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{protocolo.nome_fantasia || protocolo.razao_social}</p>
              {protocolo.nome_fantasia && (
                <p className="text-muted-foreground text-xs">{protocolo.razao_social}</p>
              )}
              <p className="text-muted-foreground font-mono text-xs">{formatCpfCnpj(protocolo.cnpj)}</p>
              {protocolo.solicitante && <p className="text-muted-foreground text-xs">Solicitante: {protocolo.solicitante}</p>}
              {protocolo.tipo_empresa && <p className="text-muted-foreground text-xs">Tipo de Empresa: {protocolo.tipo_empresa}</p>}
              {protocolo.tipo_servico && <p className="text-muted-foreground text-xs">Tipo de Serviço: {protocolo.tipo_servico}</p>}
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
                <input
                  id="bairro"
                  value={bairroDropdownOpen ? bairroSearch : (editForm.bairro || "")}
                  onChange={(e) => {
                    setBairroSearch(e.target.value);
                    if (!bairroDropdownOpen) setBairroDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setBairroSearch(editForm.bairro || "");
                    setBairroDropdownOpen(true);
                  }}
                  placeholder={editForm.municipio ? "Digite para buscar..." : "Selecione o município primeiro"}
                  disabled={!editForm.municipio}
                  className={cn(inputClass, !editForm.municipio && "opacity-50")}
                />
                {bairroDropdownOpen && editForm.municipio && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {bairrosFiltered.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          handleEditChange("bairro", b.nome);
                          setBairroSearch("");
                          setBairroDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        {b.nome}
                      </button>
                    ))}
                    {bairroNotFound && (
                      <button
                        type="button"
                        onClick={() => openNovoBairroDialog(bairroSearch)}
                        disabled={savingBairro}
                        className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-1.5 border-t border-border"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {savingBairro ? "Cadastrando..." : `Cadastrar "${bairroSearch}"`}
                      </button>
                    )}
                    {bairrosFiltered.length === 0 && !bairroNotFound && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum bairro encontrado</div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="area" className="text-xs text-muted-foreground">Área (m²)</label>
                <input id="area" type="text" value={editForm.area || ""} onChange={(e) => handleEditChange("area", e.target.value)} className={inputClass} placeholder="Ex: 1.234,56" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="latitude" className="text-xs text-muted-foreground">Latitude</label>
                  <input id="latitude" type="text" inputMode="decimal" value={editForm.latitude || ""} onChange={(e) => handleEditChange("latitude", e.target.value.replace(",", "."))} placeholder="-9.975403" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="longitude" className="text-xs text-muted-foreground">Longitude</label>
                  <input id="longitude" type="text" inputMode="decimal" value={editForm.longitude || ""} onChange={(e) => handleEditChange("longitude", e.target.value.replace(",", "."))} placeholder="-67.842870" className={inputClass} />
                </div>
              </div>
              <button
                type="button"
                onClick={geocodeAddress}
                disabled={geocoding || (!editForm.cep && (!editForm.endereco || !editForm.municipio))}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-input text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 w-full justify-center"
              >
                {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                {geocoding ? "Buscando..." : "Buscar coordenadas"}
              </button>
              {(editForm.latitude && editForm.longitude) && (
                <button
                  type="button"
                  onClick={() => navigate("/mapa")}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-input text-xs font-medium hover:bg-accent transition-colors w-full justify-center text-primary"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Abrir no mapa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {protocolo.cep && <p className="text-muted-foreground text-xs">CEP: {protocolo.cep}</p>}
              <p>{protocolo.endereco}</p>
              <p className="text-muted-foreground">{protocolo.bairro} — {protocolo.municipio}</p>
              {protocolo.area && <p className="text-muted-foreground">Área: {protocolo.area} m²</p>}
              {protocolo.latitude && protocolo.longitude && (
                <>
                  <p className="text-muted-foreground text-xs font-mono">
                    📍 {Number(protocolo.latitude).toFixed(6)}, {Number(protocolo.longitude).toFixed(6)}
                  </p>
                  <button
                    onClick={() => navigate("/mapa")}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                  >
                    <MapPin className="w-3 h-3" />
                    Abrir no mapa
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expiration Warning */}
      {processo && vistoria && (
        <ExpirationWarning
          vistoria={vistoria}
          pausas={pausas}
          processoId={processo.id}
          displayStatus={computeDisplayStatus(processo.status, {
            data_1_atribuicao: (vistoria as any).data_1_atribuicao,
            data_2_atribuicao: (vistoria as any).data_2_atribuicao,
            data_3_atribuicao: (vistoria as any).data_3_atribuicao,
            data_1_vistoria: vistoria.data_1_vistoria,
            data_2_vistoria: vistoria.data_2_vistoria,
            data_3_vistoria: vistoria.data_3_vistoria,
            status_1_vistoria: vistoria.status_1_vistoria,
            status_2_vistoria: vistoria.status_2_vistoria,
            status_3_vistoria: vistoria.status_3_vistoria,
            data_1_retorno: vistoria.data_1_retorno,
            data_2_retorno: vistoria.data_2_retorno,
          })}
          termoValidade={termo?.data_validade || null}
          onUpdate={fetchData}
        />
      )}

      {/* Vistoria Tabs */}
      {processo && vistoria && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            Vistorias
          </div>
          <Tabs defaultValue="vistoria1">
            <TabsList className="w-full grid grid-cols-3">
              {[1, 2, 3].map((n) => {
                const atrib = (vistoria as any)?.[`data_${n}_atribuicao`];
                const stVist = (vistoria as any)?.[`status_${n}_vistoria`];
                let dotColor = "bg-muted-foreground/30"; // sem dados
                if (stVist === "pendencia") dotColor = "bg-[hsl(var(--status-pending))]";
                else if (stVist === "aprovado") dotColor = "bg-[hsl(var(--status-certified-term))]";
                else if (stVist === "reprovado") dotColor = "bg-[hsl(var(--status-certified))]";
                else if (atrib) dotColor = "bg-[hsl(var(--status-assigned))]";
                return (
                  <TabsTrigger key={n} value={`vistoria${n}`} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    {n}ª Vistoria
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsContent value="vistoria1">
              <VistoriaTab
                numero={1}
                dataSolicitacao={protocolo.data_solicitacao}
                dataVistoria={vistoria?.data_1_vistoria}
                statusVistoria={vistoria?.status_1_vistoria}
                dataRetorno={vistoria?.data_1_retorno}
                vistoriadorId={vistoria?.vistoriador_1_id}
                vistoriadores={vistoriadores}
                processoId={processo.id}
                vistoriaId={vistoria?.id}
                dataAtribuicao={(vistoria as any)?.data_1_atribuicao}
                termo={termo}
                onUpdate={fetchData}
              />
            </TabsContent>
            <TabsContent value="vistoria2">
              <VistoriaTab
                numero={2}
                dataSolicitacao={protocolo.data_solicitacao}
                dataVistoria={vistoria?.data_2_vistoria}
                statusVistoria={vistoria?.status_2_vistoria}
                dataRetorno={vistoria?.data_1_retorno}
                vistoriadorId={vistoria?.vistoriador_2_id}
                vistoriadores={vistoriadores}
                processoId={processo.id}
                vistoriaId={vistoria?.id}
                dataAtribuicao={(vistoria as any)?.data_2_atribuicao}
                termo={termo}
                onUpdate={fetchData}
              />
            </TabsContent>
            <TabsContent value="vistoria3">
              <VistoriaTab
                numero={3}
                dataSolicitacao={protocolo.data_solicitacao}
                dataVistoria={vistoria?.data_3_vistoria}
                statusVistoria={vistoria?.status_3_vistoria}
                dataRetorno={vistoria?.data_2_retorno}
                vistoriadorId={vistoria?.vistoriador_3_id}
                vistoriadores={vistoriadores}
                processoId={processo.id}
                vistoriaId={vistoria?.id}
                dataAtribuicao={(vistoria as any)?.data_3_atribuicao}
                termo={termo}
                onUpdate={fetchData}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
      {/* Dialog novo bairro */}
      <Dialog open={novoBairroDialog} onOpenChange={setNovoBairroDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar novo bairro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label htmlFor="novoBairroMunicipio" className="text-xs text-muted-foreground">Município</label>
              <input id="novoBairroMunicipio" value={editForm.municipio || ""} disabled className={cn(inputClass, "opacity-60")} />
            </div>
            <div className="space-y-1">
              <label htmlFor="novoBairroNome" className="text-xs text-muted-foreground">Nome do Bairro</label>
              <input
                id="novoBairroNome"
                value={novoBairroNome}
                onChange={(e) => setNovoBairroNome(e.target.value)}
                placeholder="Digite o nome do bairro"
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="novoBairroRegional" className="text-xs text-muted-foreground">Regional</label>
              <select
                id="novoBairroRegional"
                value={novoBairroRegional}
                onChange={(e) => setNovoBairroRegional(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione a regional</option>
                {regionaisFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNovoBairroDialog(false)}
                className="px-4 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNovoBairro}
                disabled={savingBairro || !novoBairroNome.trim()}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                {savingBairro ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
