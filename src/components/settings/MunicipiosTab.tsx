import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

interface Municipio {
  id: string;
  nome: string;
}

export default function MunicipiosTab() {
  const [items, setItems] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("municipios").select("*").order("nome");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("municipios").insert({ nome: newName });
    if (error) {
      toast.error("Erro ao salvar município: " + error.message);
    } else {
      toast.success("Município salvo com sucesso!");
      setNewName("");
      setShowNew(false);
      fetchData();
    }
  };

  const startEdit = (m: Municipio) => { setEditing(m.id); setEditName(m.nome); };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("municipios").update({ nome: editName }).eq("id", editing);
    if (error) {
      toast.error("Erro ao atualizar município: " + error.message);
    } else {
      toast.success("Município atualizado!");
      setEditing(null);
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Municípios</h3>
        <button onClick={() => setShowNew(!showNew)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo Município
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="bg-accent/50 rounded-lg p-4 border border-border flex gap-3 items-end">
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium text-foreground">Nome</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" placeholder="Nome do município" />
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
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Nome</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-accent/30">
                  {editing === m.id ? (
                    <>
                      <td className="py-1.5 px-3">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm" />
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button onClick={saveEdit} className="p-1 hover:bg-accent rounded"><Check className="w-4 h-4 text-[hsl(var(--status-certified))]" /></button>
                        <button onClick={() => setEditing(null)} className="p-1 hover:bg-accent rounded ml-1"><X className="w-4 h-4 text-muted-foreground" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 font-medium">{m.nome}</td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => startEdit(m)} className="p-1 hover:bg-accent rounded"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={2} className="py-6 text-center text-muted-foreground text-sm">Nenhum município cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
