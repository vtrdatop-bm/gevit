import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Save, Plus, LocateFixed, Loader2, Search, MapPin } from "lucide-react";
import { cn, formatProtocoloNumero, applyAreaMask, parseAreaToNumber } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Bairro {
  id: string;
  nome: string;
  municipio: string;
  regional_id: string | null;
}

interface Municipio {
  id: string;
  nome: string;
}

interface Regional {
  id: string;
  nome: string;
}

interface RegionalMunicipio {
  regional_id: string;
  municipio_id: string;
}

type FormData = Record<string, string>;

const inputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}


function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/(\d{2})(\d)/, "$1.$2");
  return digits.replace(/(\d{2})(\d{3})(\d)/, "$1.$2-$3");
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ManualProtocolForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(() => {
    const saved = sessionStorage.getItem("manual_protocol_form");
    return saved ? JSON.parse(saved) : {};
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [regionaisMunicipios, setRegionaisMunicipios] = useState<RegionalMunicipio[]>([]);

  // Bairro search
  const [bairroSearch, setBairroSearch] = useState("");
  const [bairroDropdownOpen, setBairroDropdownOpen] = useState(false);
  const bairroRef = useRef<HTMLDivElement>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoBairroNome, setNovoBairroNome] = useState("");
  const [novoBairroRegional, setNovoBairroRegional] = useState("");
  const [savingBairro, setSavingBairro] = useState(false);
  const [bairroError, setBairroError] = useState("");

  // Geocoding
  const [geocoding, setGeocoding] = useState(false);

  // CNPJ lookup
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const lastCnpjSearched = useRef<string>("");

  const lookupCnpj = useCallback(async (cnpjDigits: string, quiet = false) => {
    if (cnpjDigits.length !== 14 || cnpjDigits === lastCnpjSearched.current) return;
    
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

      setForm((prev) => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social || "",
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia || "",
        endereco: enderecoCompleto || prev.endereco || "",
        bairro: (data.bairro || prev.bairro || "").toUpperCase(),
        municipio: (data.municipio || prev.municipio || "").toUpperCase(),
        cep: data.cep ? formatCep(data.cep.toString().replace(/\D/g, "")) : prev.cep || "",
      }));
      if (!quiet) toast.success("Dados do CNPJ preenchidos!");
    } catch (err) {
      if (!quiet) {
        toast.error("Erro ao conectar com o serviço de busca de CNPJ.");
      }
    } finally {
      setCnpjLoading(false);
    }
  }, []);

  // Debounced CNPJ lookup for automatic search
  useEffect(() => {
    const digits = (form.cnpj || "").replace(/\D/g, "");
    if (digits.length === 14 && digits !== lastCnpjSearched.current) {
      const timer = setTimeout(() => {
        lookupCnpj(digits, true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [form.cnpj, lookupCnpj]);

  useEffect(() => {
    sessionStorage.setItem("manual_protocol_form", JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    Promise.all([
      supabase.from("municipios").select("*").order("nome"),
      supabase.from("bairros").select("id, nome, municipio, regional_id").order("nome"),
      supabase.from("regionais").select("*").order("nome"),
      supabase.from("regionais_municipios").select("regional_id, municipio_id"),
    ]).then(([{ data: m }, { data: b }, { data: r }, { data: rm }]) => {
      setMunicipios(m || []);
      setBairros(b || []);
      setRegionais(r || []);
      setRegionaisMunicipios(rm || []);
    });
  }, []);

  // Close bairro dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bairroRef.current && !bairroRef.current.contains(e.target as Node)) {
        setBairroDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const bairrosFiltered = useMemo(() => {
    if (!form.municipio) return [];
    const filtered = bairros.filter((b) => b.municipio === form.municipio);
    if (!bairroSearch.trim()) return filtered;
    return filtered.filter((b) => b.nome.toLowerCase().includes(bairroSearch.toLowerCase()));
  }, [bairros, form.municipio, bairroSearch]);

  const bairroNotFound = useMemo(() => {
    if (!bairroSearch.trim() || !form.municipio) return false;
    return !bairros.some(
      (b) => b.municipio === form.municipio && b.nome.toLowerCase() === bairroSearch.toLowerCase()
    );
  }, [bairroSearch, bairros, form.municipio]);

  const regionaisFiltradas = useMemo(() => {
    if (!form.municipio) return [];
    const mun = municipios.find((m) => m.nome === form.municipio);
    if (!mun) return [];
    const regionalIds = regionaisMunicipios
      .filter((rm) => rm.municipio_id === mun.id)
      .map((rm) => rm.regional_id);
    return regionais.filter((r) => regionalIds.includes(r.id));
  }, [form.municipio, municipios, regionaisMunicipios, regionais]);

  const handleChange = (key: string, value: string) => {
    let finalValue = value;
    if (key === "municipio" || key === "bairro") {
      finalValue = value.toUpperCase();
    }
    if (key === "area") {
      finalValue = applyAreaMask(value);
    }
    setForm((prev) => {
      const next = { ...prev, [key]: finalValue };
      if (key === "municipio") {
        next.bairro = "";
        setBairroSearch("");
      }
      return next;
    });
    setResult(null);
  };

  const openNovoBairroDialog = (nome: string) => {
    setNovoBairroNome(nome);
    setNovoBairroRegional("");
    setBairroError("");
    setBairroDropdownOpen(false);
    setDialogOpen(true);
  };

  const handleSaveNovoBairro = async () => {
    const nome = novoBairroNome.trim().toUpperCase();
    if (!nome) {
      setBairroError("Informe o nome do bairro");
      return;
    }
    setSavingBairro(true);
    setBairroError("");

    const { error } = await supabase.from("bairros").insert({
      nome,
      municipio: form.municipio,
      regional_id: novoBairroRegional || null,
    });

    if (error) {
      setBairroError("Erro: " + error.message);
      setSavingBairro(false);
      return;
    }

    const { data: newBairros } = await supabase.from("bairros").select("id, nome, municipio, regional_id").order("nome");
    setBairros(newBairros || []);
    setForm((prev) => ({ ...prev, bairro: nome }));
    setBairroSearch("");
    setSavingBairro(false);
    setDialogOpen(false);
    toast.success(`Bairro "${nome}" cadastrado!`);
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
      const endereco = form.endereco || "";
      const municipioStr = form.municipio || "";
      const bairroStr = form.bairro || "";
      const cep = form.cep || "";

      // Construir endereço completo para o Google
      const fullAddress = [
        endereco,
        bairroStr,
        municipioStr,
        "Acre",
        cep,
        "Brasil"
      ].filter(Boolean).join(", ");

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${googleApiKey}&language=pt-BR`
      );
      
      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;

        setForm((prev) => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        }));
        toast.success("Localizado com precisão via Google Maps!");
      } else {
        console.error("Google Geocoding Error:", data.status, data.error_message);
        toast.error("Endereço não encontrado no Google Maps");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      toast.error("Erro ao conectar com o Google Maps");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const cnpjClean = (form.cnpj || "").replace(/\D/g, "");
    if (cnpjClean.length !== 11 && cnpjClean.length !== 14) {
      setResult({ type: "error", message: "CPF/CNPJ inválido — deve conter 11 ou 14 dígitos" });
      setSaving(false);
      return;
    }

    const { data: inserted, error } = await supabase.from("protocolos").insert({
      numero: form.numero,
      data_solicitacao: form.data_solicitacao,
      cnpj: cnpjClean,
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia || null,
      endereco: form.endereco,
      bairro: (form.bairro || "").toUpperCase(),
      municipio: (form.municipio || "").toUpperCase(),
      area: form.area ? parseAreaToNumber(form.area) : null,
      cep: form.cep?.replace(/\D/g, "") || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    }).select().single();

    if (error) {
      setResult({ type: "error", message: error.message });
    } else if (inserted) {
      // Auto-create processo (status 'regional' = Aguardando Vistoria)
      const { data: proc, error: procError } = await supabase
        .from("processos")
        .insert({ protocolo_id: inserted.id, status: "regional" })
        .select()
        .single();

      if (proc && !procError) {
        // Auto-create vistoria linked to the processo
        await supabase.from("vistorias").insert({ processo_id: proc.id });
      }

      setResult({ type: "success", message: "Protocolo cadastrado com sucesso!" });
      setForm({});
      sessionStorage.removeItem("manual_protocol_form");
      setBairroSearch("");
    }
    setSaving(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nº Protocolo" required>
            <input value={form.numero || ""} onChange={(e) => handleChange("numero", formatProtocoloNumero(e.target.value))} required placeholder="VT0000.0000.0000-00" className={inputClass} />
          </Field>
          <Field label="Data Solicitação" required>
            <input type="date" value={form.data_solicitacao || ""} onChange={(e) => handleChange("data_solicitacao", e.target.value)} required className={inputClass} />
          </Field>
          <Field label="CPF/CNPJ" required>
            <div className="flex gap-2">
              <input
                value={form.cnpj || ""}
                onChange={(e) => {
                  const formatted = formatCpfCnpj(e.target.value);
                  handleChange("cnpj", formatted);
                }}
                required
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => lookupCnpj((form.cnpj || "").replace(/\D/g, ""))}
                disabled={cnpjLoading || (form.cnpj || "").replace(/\D/g, "").length !== 14}
                title="Buscar dados do CNPJ"
                className="flex items-center justify-center px-3 h-10 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
              >
                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="Razão Social" required>
            <input value={form.razao_social || ""} onChange={(e) => handleChange("razao_social", e.target.value)} required placeholder="Razão social da empresa" className={inputClass} />
          </Field>
          <Field label="Nome Fantasia">
            <input value={form.nome_fantasia || ""} onChange={(e) => handleChange("nome_fantasia", e.target.value)} placeholder="Nome fantasia" className={inputClass} />
          </Field>
          <Field label="Endereço" required>
            <input value={form.endereco || ""} onChange={(e) => handleChange("endereco", e.target.value)} required placeholder="Rua, número" className={inputClass} />
          </Field>
          <Field label="CEP">
            <input value={form.cep || ""} onChange={(e) => handleChange("cep", formatCep(e.target.value))} placeholder="69.999-999" className={inputClass} />
          </Field>

          <Field label="Município" required>
            <select value={form.municipio || ""} onChange={(e) => handleChange("municipio", e.target.value)} required className={inputClass}>
              <option value="">Selecione o município</option>
              {municipios.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
          </Field>

          <Field label="Bairro" required>
            <div className="relative" ref={bairroRef}>
              <input
                value={bairroDropdownOpen ? bairroSearch : (form.bairro || "")}
                onChange={(e) => {
                  setBairroSearch(e.target.value);
                  if (!bairroDropdownOpen) setBairroDropdownOpen(true);
                }}
                onFocus={() => {
                  setBairroSearch(form.bairro || "");
                  setBairroDropdownOpen(true);
                }}
                placeholder={form.municipio ? "Digite para buscar..." : "Selecione o município primeiro"}
                disabled={!form.municipio}
                required
                className={cn(inputClass, !form.municipio && "opacity-50")}
              />
              {bairroDropdownOpen && form.municipio && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {bairrosFiltered.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        handleChange("bairro", b.nome);
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
                      className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors flex items-center gap-1.5 border-t border-border"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Cadastrar "{bairroSearch}"
                    </button>
                  )}
                  {bairrosFiltered.length === 0 && !bairroNotFound && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum bairro encontrado</div>
                  )}
                </div>
              )}
            </div>
          </Field>

          <Field label="Área (m²)">
            <input type="text" value={form.area || ""} onChange={(e) => handleChange("area", e.target.value)} placeholder="Ex: 1.234,56" className={inputClass} />
          </Field>

          <Field label="Coordenadas Geográficas">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={form.latitude || ""}
                onChange={(e) => handleChange("latitude", e.target.value.replace(",", "."))}
                placeholder="-9.975403"
                className={inputClass}
              />
              <input
                type="text"
                inputMode="decimal"
                value={form.longitude || ""}
                onChange={(e) => handleChange("longitude", e.target.value.replace(",", "."))}
                placeholder="-67.842870"
                className={inputClass}
              />
            </div>
          </Field>

          <div className="flex flex-col gap-2">
            <Field label="">
              <button
                type="button"
                onClick={geocodeAddress}
                disabled={geocoding || (!form.cep && (!form.endereco || !form.municipio))}
                className="flex items-center gap-1.5 px-3 h-10 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 w-full justify-center"
              >
                {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                {geocoding ? "Buscando..." : "Buscar coordenadas"}
              </button>
            </Field>

            {form.latitude && form.longitude && (
              <button
                type="button"
                onClick={() => navigate("/mapa", { state: { focusCoords: [parseFloat(form.latitude), parseFloat(form.longitude)] } })}
                className="flex items-center gap-1.5 px-3 h-10 rounded-md bg-accent/50 text-accent-foreground text-sm font-medium hover:bg-accent transition-colors w-full justify-center"
              >
                <MapPin className="w-4 h-4" />
                Abrir no mapa
              </button>
            )}
          </div>
        </div>

        {result && (
          <div className={cn(
            "rounded-lg p-3 flex items-center gap-2 text-sm",
            result.type === "success"
              ? "bg-[hsl(var(--status-certified)/0.1)] border border-[hsl(var(--status-certified)/0.2)] text-[hsl(var(--status-certified))]"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          )}>
            {result.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {result.message}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Cadastrar Protocolo"}
        </button>
      </form>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar novo bairro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Município">
              <input value={form.municipio || ""} disabled className={cn(inputClass, "opacity-60")} />
            </Field>
            <Field label="Nome do Bairro" required>
              <input
                value={novoBairroNome}
                onChange={(e) => setNovoBairroNome(e.target.value)}
                placeholder="Digite o nome do bairro"
                className={inputClass}
                autoFocus
              />
            </Field>
            <Field label="Regional">
              <select
                value={novoBairroRegional}
                onChange={(e) => setNovoBairroRegional(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione (opcional)</option>
                {regionaisFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </Field>

            {bairroError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {bairroError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 h-9 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNovoBairro}
                disabled={savingBairro}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                {savingBairro ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
