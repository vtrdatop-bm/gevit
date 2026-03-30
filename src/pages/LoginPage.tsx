import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Flame, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!login || !senha) {
      setError("Preencha login e senha.");
      setLoading(false);
      return;
    }

    const loginTrimmed = login.trim().toLowerCase();
    const email = loginTrimmed.includes("@") ? loginTrimmed : `${loginTrimmed}@gevit.com.br`;
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: senha.trim(),
    });

    if (authError) {
      setError("Login ou senha inválidos.");
      setLoading(false);
      return;
    }

    navigate("/");
  };

  const handleDevBypass = () => {
    localStorage.setItem("gevit_admin_bypass", "true");
    window.location.href = "/"; // Force reload to trigger useAuth bypass
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="GEVIT Logo" className="w-full h-full object-contain rounded-[22%] shadow-md border border-border/50" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GEVIT</h1>
          <p className="text-sm text-muted-foreground">Gestão de Vistorias Técnicas</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="primeironome.sobrenome"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Digite sua senha"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>


      </div>
    </div>
  );
}
