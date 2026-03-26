import { useState, useEffect } from "react";
import { Users, MapPin, Building2, Map, UserCog, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import UsersTab from "@/components/settings/UsersTab";
import RegionaisTab from "@/components/settings/RegionaisTab";
import MunicipiosTab from "@/components/settings/MunicipiosTab";
import BairrosTab from "@/components/settings/BairrosTab";
import MinhaContaTab from "@/components/settings/MinhaContaTab";

const allTabs = [
  { key: "minha-conta", label: "Minha Conta", icon: UserCog, roles: ["admin", "distribuidor", "vistoriador"] },
  { key: "usuarios", label: "Usuários", icon: Users, roles: ["admin", "distribuidor"] },
  { key: "municipios", label: "Municípios", icon: Map, roles: ["admin", "distribuidor"] },
  { key: "regionais", label: "Regionais", icon: MapPin, roles: ["admin", "distribuidor"] },
  { key: "bairros", label: "Bairros", icon: Building2, roles: ["admin", "distribuidor"] },
] as const;

type TabKey = (typeof allTabs)[number]["key"];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("minha-conta");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setRole(data?.role || null));
  }, [user]);

  const tabs = allTabs.filter((t) => !role || (t.roles as readonly string[]).includes(role));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie usuários, municípios, regionais, bairros e parâmetros do sistema
        </p>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 md:p-6">
        {tab === "minha-conta" && <MinhaContaTab />}
        {tab === "usuarios" && <UsersTab />}
        {tab === "municipios" && <MunicipiosTab />}
        {tab === "regionais" && <RegionaisTab />}
        {tab === "bairros" && <BairrosTab />}
      </div>
    </div>
  );
}
