import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Bairro {
  id: string;
  nome: string;
  municipio: string;
  regional_id: string | null;
}

interface Regional {
  id: string;
  nome: string;
  municipio_ids: string[];
}

interface Municipio {
  id: string;
  nome: string;
}

export default function BairrosTab() {
  const [items, setItems] = useState<Bairro[]>([]);
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", municipio: "", regional_id: "" });
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", municipio: "", regional_id: "" });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: b }, { data: r }, { data: m }, { data: rm }] = await Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("regionais").select("id, nome").order("nome"),
      supabase.from("municipios").select("*").order("nome"),
      supabase.from("regionais_municipios").select("regional_id, municipio_id"),
    ]);
    const rmList = rm || [];
    const regionaisComMunicipios: Regional[] = (r || []).map((reg) => ({
      ...reg,
      municipio_ids: rmList.filter((x: any) => x.regional_id === reg.id).map((x: any) => x.municipio_id),
    }));
    setItems(b || []);
    setRegionais(regionaisComMunicipios);
    setMunicipios(m || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Filter regionais by selected município (find municipio id by name, then filter)
  const getMunicipioId = (nome: string) => municipios.find((m) => m.nome === nome)?.id;
  const newRegionaisFiltradas = useMemo(() => {
    const mid = getMunicipioId(newForm.municipio);
    return mid ? regionais.filter((r) => r.municipio_ids.includes(mid)) : [];
  }, [regionais, newForm.municipio, municipios]);
  const editRegionaisFiltradas = useMemo(() => {
    const mid = getMunicipioId(form.municipio);
    return mid ? regionais.filter((r) => r.municipio_ids.includes(mid)) : [];
  }, [regionais, form.municipio, municipios]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("bairros").insert({
      nome: newForm.nome,
      municipio: newForm.municipio,
      regional_id: newForm.regional_id || null,
    });
    if (error) {
      toast.error("Erro ao salvar bairro: " + error.message);
    } else {
      toast.success("Bairro salvo com sucesso!");
      setNewForm({ nome: "", municipio: "", regional_id: "" });
      setShowNew(false);
      fetchData();
    }
  };

  const startEdit = (b: Bairro) => {
    setEditing(b.id);
    setForm({ nome: b.nome, municipio: b.municipio, regional_id: b.regional_id || "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("bairros").update({
      nome: form.nome,
      municipio: form.municipio,
      regional_id: form.regional_id || null,
    }).eq("id", editing);
    if (error) {
      toast.error("Erro ao atualizar bairro: " + error.message);
    } else {
      toast.success("Bairro atualizado!");
      setEditing(null);
      fetchData();
    }
  };

  const regionalName = (id: string | null) => regionais.find((r) => r.id === id)?.nome || "—";

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Bairros e Áreas</h3>
        <button onClick={() => setShowNew(!showNew)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo Bairro
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="bg-accent/50 rounded-lg p-4 border border-border flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-foreground">Bairro</label>
            <input value={newForm.nome} onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })} required
              className={selectClass} placeholder="Nome do bairro" />
          </div>
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-foreground">Município</label>
            <select value={newForm.municipio} onChange={(e) => setNewForm({ ...newForm, municipio: e.target.value, regional_id: "" })} required className={selectClass}>
              <option value="">Selecione</option>
              {municipios.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-foreground">Regional</label>
            <select value={newForm.regional_id} onChange={(e) => setNewForm({ ...newForm, regional_id: e.target.value })}
              disabled={!newForm.municipio} className={cn(selectClass, !newForm.municipio && "opacity-50")}>
              <option value="">{newForm.municipio ? "Nenhuma" : "Selecione município"}</option>
              {newRegionaisFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>
          <button type="submit" className="h-9 px-4 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Salvar</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Bairro</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Município</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Regional</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-accent/30">
                  {editing === b.id ? (
                    <>
                      <td className="py-1.5 px-3">
                        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm" />
                      </td>
                      <td className="py-1.5 px-3">
                        <select value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value, regional_id: "" })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm">
                          <option value="">Selecione</option>
                          {municipios.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-3">
                        <select value={form.regional_id} onChange={(e) => setForm({ ...form, regional_id: e.target.value })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm">
                          <option value="">Nenhuma</option>
                          {editRegionaisFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button onClick={saveEdit} className="p-1 hover:bg-accent rounded"><Check className="w-4 h-4 text-[hsl(var(--status-certified))]" /></button>
                        <button onClick={() => setEditing(null)} className="p-1 hover:bg-accent rounded ml-1"><X className="w-4 h-4 text-muted-foreground" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 font-medium">{b.nome}</td>
                      <td className="py-2 px-3 text-muted-foreground">{b.municipio}</td>
                      <td className="py-2 px-3 text-muted-foreground">{regionalName(b.regional_id)}</td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => startEdit(b)} className="p-1 hover:bg-accent rounded"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">Nenhum bairro cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
