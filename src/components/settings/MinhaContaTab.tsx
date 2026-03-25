import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function MinhaContaTab() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (novaSenha !== confirmar) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });

    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmar("");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 max-w-md">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <KeyRound className="w-4 h-4" />
        Alterar Senha
      </h3>
      <form onSubmit={handleChangePassword} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Nova senha</label>
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            minLength={6}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Confirmar nova senha</label>
          <input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            minLength={6}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Repita a nova senha"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Alterando..." : "Alterar Senha"}
        </button>
      </form>
    </div>
  );
}
