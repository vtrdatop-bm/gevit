import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, X, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { RegionalData as Regional, MunicipioData as Municipio, RegionalMunicipioData as RegionalMunicipio } from "@/types/database";

export default function RegionaisTab() {
  const [items, setItems] = useState<Regional[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", municipios: [] as string[] });
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", municipios: [] as string[] });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: r }, { data: m }, { data: rm }] = await Promise.all([
      supabase.from("regionais").select("id, nome").order("nome"),
      supabase.from("municipios").select("*").order("nome"),
      supabase.from("regionais_municipios").select("regional_id, municipio_id"),
    ]);

    const rmList = (rm || []) as RegionalMunicipio[];
    const regionais: Regional[] = (r || []).map((reg) => ({
      ...reg,
      municipios: rmList.filter((x) => x.regional_id === reg.id).map((x) => x.municipio_id),
    }));

    setItems(regionais);
    setMunicipios(m || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const upperNome = newForm.nome.trim().toUpperCase();
    const { data, error } = await supabase.from("regionais").insert({ nome: upperNome }).select("id").single();
    if (error) {
      toast.error("Erro ao criar regional: " + error.message);
      return;
    }
    if (data && newForm.municipios.length > 0) {
      const { error: relError } = await supabase.from("regionais_municipios").insert(
        newForm.municipios.map((mid) => ({ regional_id: data.id, municipio_id: mid }))
      );
      if (relError) toast.error("Erro ao vincular municípios: " + relError.message);
    }
    toast.success("Regional criada com sucesso!");
    setNewForm({ nome: "", municipios: [] });
    setShowNew(false);
    fetchData();
  };

  const startEdit = (r: Regional) => {
    setEditing(r.id);
    setForm({ nome: r.nome, municipios: [...r.municipios] });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const upperNome = form.nome.trim().toUpperCase();
    const { error } = await supabase.from("regionais").update({ nome: upperNome }).eq("id", editing);
    if (error) {
      toast.error("Erro ao atualizar regional: " + error.message);
      return;
    }
    await supabase.from("regionais_municipios").delete().eq("regional_id", editing);
    if (form.municipios.length > 0) {
      const { error: relError } = await supabase.from("regionais_municipios").insert(
        form.municipios.map((mid) => ({ regional_id: editing, municipio_id: mid }))
      );
      if (relError) toast.error("Erro ao atualizar vínculos: " + relError.message);
    }
    toast.success("Regional atualizada!");
    setEditing(null);
    fetchData();
  };

  const toggleMunicipio = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const getMunicipioNome = (id: string) => municipios.find((m) => m.id === id)?.nome || "";

  const municipioNames = (ids: string[]) =>
    ids.map((id) => getMunicipioNome(id)).filter(Boolean).sort().join(", ") || "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Regionais</h3>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Nova Regional
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="bg-accent/50 rounded-lg p-4 border border-border flex gap-3 items-end">
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium text-foreground">Nome</label>
            <input
              value={newForm.nome}
              onChange={(e) => setNewForm({ ...newForm, nome: e.target.value })}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              placeholder="Nome da regional"
            />
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium text-foreground">Municípios</label>
            <MultiSelectDropdown
              selected={newForm.municipios}
              onChange={(v) => setNewForm({ ...newForm, municipios: v })}
              municipios={municipios}
              getMunicipioNome={getMunicipioNome}
              toggleMunicipio={toggleMunicipio}
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Salvar
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Nome</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Municípios</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30">
                  {editing === r.id ? (
                    <>
                      <td className="py-1.5 px-3">
                        <input
                          value={form.nome}
                          onChange={(e) => setForm({ ...form, nome: e.target.value })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <MultiSelectDropdown
                          selected={form.municipios}
                          onChange={(v) => setForm({ ...form, municipios: v })}
                          municipios={municipios}
                          getMunicipioNome={getMunicipioNome}
                          toggleMunicipio={toggleMunicipio}
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button
                          onClick={saveEdit}
                          title="Salvar alterações"
                          className="p-1 hover:bg-accent rounded"
                        >
                          <Check className="w-4 h-4 text-[hsl(var(--status-certified))]" />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          title="Cancelar edição"
                          className="p-1 hover:bg-accent rounded ml-1"
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 font-medium">{r.nome}</td>
                      <td className="py-2 px-3 text-muted-foreground">{municipioNames(r.municipios)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => startEdit(r)}
                          title="Editar regional"
                          className="p-1 hover:bg-accent rounded"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground text-sm">
                    Nenhuma regional cadastrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────── */

interface MultiSelectDropdownProps {
  selected: string[];
  onChange: (v: string[]) => void;
  municipios: Municipio[];
  getMunicipioNome: (id: string) => string;
  toggleMunicipio: (list: string[], id: string) => string[];
}

const MultiSelectDropdown = ({
  selected,
  onChange,
  municipios,
  getMunicipioNome,
  toggleMunicipio,
}: MultiSelectDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sortedMunicipios = useMemo(() => {
    return [...municipios].sort((a, b) => {
      const aS = selected.includes(a.id);
      const bS = selected.includes(b.id);
      if (aS && !bS) return -1;
      if (!aS && bS) return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [municipios, selected]);

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
              {selected.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  {getMunicipioNome(id)}
                  <button
                    type="button"
                    title="Remover município"
                    onClick={() => onChange(selected.filter((x) => x !== id))}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Selecione municípios"
        aria-label="Selecionar mais municípios"
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm"
      >
        <span className="truncate text-left text-muted-foreground">{selected.length === 0 ? "Selecione..." : "Adicionar..."}</span>
        <ChevronDown className="w-3.5 h-3.5 ml-1 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto p-1">
          {municipios.length === 0 && <p className="text-xs text-muted-foreground p-2">Sem municípios</p>}
          {sortedMunicipios.map((m) => {
            const isSelected = selected.includes(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer ${isSelected ? "bg-accent/50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onChange(toggleMunicipio(selected, m.id))}
                  className="w-4 h-4 rounded border-input accent-primary"
                />
                <span className="flex-1">{m.nome}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
