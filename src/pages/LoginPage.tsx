import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Flame, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Cadastro
  const [registering, setRegistering] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
    const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setRegistering(true);
      setRegisterError("");
      setRegisterSuccess("");
      const signupEmail = registerEmail.includes("@") ? registerEmail : `${registerEmail}@gevit.local`;
      const { error } = await supabase.auth.signUp({ email: signupEmail, password: registerPassword });
      if (error) {
        setRegisterError(error.message);
      } else {
        setRegisterSuccess("Usuário cadastrado! Faça login.");
        setRegisterEmail("");
        setRegisterPassword("");
      }
      setRegistering(false);
    };
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const loginEmail = email.includes("@") ? email : `${email}@gevit.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Flame className="w-8 h-8 text-primary-foreground" />
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="primeiro.sobrenome"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

      </div>

      {/* Cadastro de usuário */}
      <div className="w-full max-w-sm mt-8">
        <h2 className="text-lg font-semibold mb-2 text-foreground">Cadastrar novo usuário</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          {registerError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              {registerError}
            </div>
          )}
          {registerSuccess && (
            <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-3 text-sm text-emerald-700">
              {registerSuccess}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Login</label>
            <input
              type="text"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="primeiro.sobrenome"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Senha</label>
            <input
              type="password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={registering}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {registering ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
