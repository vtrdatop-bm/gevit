import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Shield, Pencil, X, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Profile = Tables<"profiles"> & { roles: string[] };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  distribuidor: "Distribuidor",
  vistoriador: "Vistoriador",
};

const ROLE_OPTIONS = ["admin", "distribuidor", "vistoriador"] as const;

const POSTOS_GRADUACOES = [
  "CEL BM", "TC BM", "MAJ BM", "CAP BM", "1º TEN BM", "2º TEN BM", "CAD BM", "ASP BM", "AL OF BM", "ST BM", "1º SGT BM", "2º SGT BM", "3º SGT BM", "AL SGT BM", "CB BM", "AL CB BM", "SD BM", "FC"
];

export default function UsersTab() {
  const { user, isDev } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ login: "", senha: "", nome_guerra: "", patente: "SD BM", roles: ["vistoriador"] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome_guerra: "", patente: "", roles: [] as string[], ativo: true });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (isDev) {
      setProfiles([
        { 
          id: "dev-id", 
          user_id: "00000000-0000-0000-0000-000000000000", 
          nome_guerra: "ADMIN", 
          ativo: true, 
          roles: ["admin"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          login: "admin.dev",
          patente: "ADM",
          regional_id: null
        } as any
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: profs } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    const merged = (profs || []).map((p) => ({
      ...p,
      roles: (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role),
    }));
    setProfiles(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [isDev]);

  useEffect(() => {
    if (user) {
      if (isDev) {
        setIsAdmin(true);
        setCanManageUsers(true);
        return;
      }
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
        setIsAdmin(!!data);
      });
      supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
        const roles = (data || []).map(r => r.role);
        setCanManageUsers(roles.includes("admin") || roles.includes("distribuidor"));
      });
    }
  }, [user, isDev]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const loginLower = form.login.toLowerCase();
    if (form.roles.length === 0 || form.roles.length > 2) {
      setError("Selecione 1 ou 2 perfis para o usuário.");
      setSaving(false);
      return;
    }

    const email = loginLower.includes("@") ? loginLower : `${loginLower}@gevit.com.br`;
    const { data: signUpData, error: signupErr } = await supabase.auth.signUp({
      email,
      password: form.senha,
      options: { data: { nome_guerra: form.nome_guerra, patente: form.patente, role: form.roles[0] } },
    });

    if (signupErr) {
      setError(signupErr.message);
      setSaving(false);
      return;
    }

    const newUserId = signUpData?.user?.id;
    if (newUserId && form.roles.length > 1) {
      const additionalRoles = form.roles.slice(1).map((role) => ({ user_id: newUserId, role: role as any }));
      await supabase.from("user_roles").insert(additionalRoles);
    }

    setForm({ login: "", senha: "", nome_guerra: "", patente: "SD BM", roles: ["vistoriador"] });
    setShowForm(false);
    setSaving(false);
    setTimeout(fetchUsers, 1000);
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditForm({
      nome_guerra: p.nome_guerra,
      patente: p.patente || "SD BM",
      roles: p.roles.length > 0 ? p.roles : ["vistoriador"],
      ativo: p.ativo,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (p: Profile) => {
    setSaving(true);

    const nomeGuerra = editForm.nome_guerra.trim();
    if (!nomeGuerra) {
      toast.error("Nome de guerra e obrigatorio.");
      setSaving(false);
      return;
    }

    const { data: updatedProfiles, error: profileErr } = await supabase
      .from("profiles")
      .update({
        nome_guerra: nomeGuerra,
        patente: editForm.patente || null,
        ativo: editForm.ativo,
      })
      .eq("user_id", p.user_id)
      .select("id");

    if (profileErr) {
      toast.error("Erro ao atualizar perfil: " + profileErr.message);
      setSaving(false);
      return;
    }

    if (!updatedProfiles || updatedProfiles.length === 0) {
      toast.error("Nao foi possivel salvar as alteracoes deste usuario.");
      setSaving(false);
      return;
    }

    if (editForm.roles.length === 0 || editForm.roles.length > 2) {
      toast.error("Selecione 1 ou 2 perfis.");
      setSaving(false);
      return;
    }

    const currentRoles = new Set(p.roles);
    const nextRoles = new Set(editForm.roles);
    const rolesToDelete = p.roles.filter((role) => !nextRoles.has(role));
    const rolesToInsert = editForm.roles.filter((role) => !currentRoles.has(role));

    if (rolesToDelete.length > 0) {
      await supabase.from("user_roles").delete().eq("user_id", p.user_id).in("role", rolesToDelete as any);
    }
    if (rolesToInsert.length > 0) {
      await supabase.from("user_roles").insert(rolesToInsert.map((role) => ({ user_id: p.user_id, role: role as any })));
    }

    toast.success("Usuário atualizado com sucesso");
    setEditingId(null);
    setSaving(false);
    fetchUsers();
  };

  const handleDelete = async (p: Profile) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${[p.patente, p.nome_guerra].filter(Boolean).join(" ")}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setDeletingId(p.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: p.user_id },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || "Erro ao excluir usuário");
      } else {
        toast.success("Usuário excluído com sucesso");
        fetchUsers();
      }
    } catch {
      toast.error("Erro ao excluir usuário");
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Usuários cadastrados</h3>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Novo Usuário
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="bg-accent/50 rounded-lg p-4 space-y-3 border border-border">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Posto/Graduação</label>
              <select value={form.patente} onChange={(e) => setForm({ ...form, patente: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                {POSTOS_GRADUACOES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Nome de Guerra</label>
              <input value={form.nome_guerra} onChange={(e) => setForm({ ...form, nome_guerra: e.target.value })} required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" placeholder="Nome de guerra" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Login</label>
              <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" placeholder="primeiro.sobrenome" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Senha</label>
              <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Perfis (1 ou 2)</label>
              <div className="space-y-1.5 rounded-md border border-input bg-background px-3 py-2">
                {ROLE_OPTIONS.map((role) => {
                  const checked = form.roles.includes(role);
                  const disabled = !checked && form.roles.length >= 2;
                  return (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => {
                          setForm((prev) => {
                            if (e.target.checked) {
                              return { ...prev, roles: [...prev.roles, role] };
                            }
                            return { ...prev, roles: prev.roles.filter((r) => r !== role) };
                          });
                        }}
                      />
                      <span>{ROLE_LABELS[role]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Criando..." : "Criar Usuário"}
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
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Nome de Guerra</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Login</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Perfil</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Status</th>
                {canManageUsers && <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30">
                  {editingId === p.id ? (
                    <>
                      <td className="py-2 px-3">
                        <select value={editForm.patente} onChange={(e) => setEditForm({ ...editForm, patente: e.target.value })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm mb-1">
                          {POSTOS_GRADUACOES.map(pg => <option key={pg} value={pg}>{pg}</option>)}
                        </select>
                        <input value={editForm.nome_guerra} onChange={(e) => setEditForm({ ...editForm, nome_guerra: e.target.value })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{(p as any).login || "—"}</td>
                      <td className="py-2 px-3">
                        <div className="space-y-1 rounded-md border border-input bg-background px-2 py-1.5">
                          {ROLE_OPTIONS.map((role) => {
                            const checked = editForm.roles.includes(role);
                            const disabled = !checked && editForm.roles.length >= 2;
                            return (
                              <label key={role} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={(e) => {
                                    setEditForm((prev) => {
                                      if (e.target.checked) {
                                        return { ...prev, roles: [...prev.roles, role] };
                                      }
                                      return { ...prev, roles: prev.roles.filter((r) => r !== role) };
                                    });
                                  }}
                                />
                                <span>{ROLE_LABELS[role]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <select value={editForm.ativo ? "ativo" : "inativo"} onChange={(e) => setEditForm({ ...editForm, ativo: e.target.value === "ativo" })}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => saveEdit(p)} disabled={saving}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary disabled:opacity-50" title="Salvar">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground" title="Cancelar">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                       <td className="py-2 px-3 font-medium">{[p.patente, p.nome_guerra].filter(Boolean).join(" ")}</td>
                      <td className="py-2 px-3 text-muted-foreground">{(p as any).login || "—"}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {p.roles.map((r) => (
                            <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              <Shield className="w-3 h-3" />
                              {ROLE_LABELS[r] || r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                          p.ativo ? "bg-[hsl(var(--status-certified)/0.1)] text-[hsl(var(--status-certified))]" : "bg-muted text-muted-foreground"
                        )}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      {canManageUsers && (
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(p)}
                              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDelete(p)} disabled={deletingId === p.id}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50" title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Nenhum usuário cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
