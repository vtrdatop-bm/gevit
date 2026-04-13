import { useState, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Columns3,
  Map,
  Upload,
  FilePlus,
  FileText,
  Route,
  ClipboardList,
  Bell,
  Settings,
  Menu,
  X,
  Flame,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NotificationDaemon from "@/components/layout/NotificationDaemon";

const allNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "distribuidor"] },
  { path: "/protocolos", label: "Protocolos", icon: FileText, roles: ["admin", "distribuidor"] },
  { path: "/kanban", label: "Gerenciamento", icon: Columns3, roles: ["admin", "distribuidor"] },
  { path: "/vistorias", label: "Minhas Vistorias", icon: ClipboardList, roles: ["admin", "distribuidor", "vistoriador"] },
  { path: "/mapa", label: "Mapa", icon: Map, roles: ["admin", "distribuidor", "vistoriador"] },
  { path: "/rotas", label: "Rotas", icon: Route, roles: ["admin", "distribuidor", "vistoriador"] },

  { path: "/notificacoes", label: "Notificações", icon: Bell, roles: ["admin", "distribuidor", "vistoriador"] },
  { path: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin", "distribuidor", "vistoriador"] },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, roles, activeRole, setActiveRole } = useAuth();

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrador",
    distribuidor: "Distribuidor",
    vistoriador: "Vistoriador",
  };

  const navItems = allNavItems.filter(
    (item) => !activeRole || item.roles.includes(activeRole)
  );

  useEffect(() => {
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      setUnreadCount(0);
      return;
    }

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("lida", false);
      setUnreadCount(count || 0);
    };
    fetchUnread();

    const channel = supabase
      .channel("notificacoes-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-50 h-full flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border flex-shrink-0">
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/logo.png" alt="GEVIT" className="w-full h-full object-contain rounded-[22%] shadow-sm" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground truncate">
                GEVIT
              </h1>
              <p className="text-[10px] text-sidebar-muted truncate">
                Gestão de Vistorias Técnicas
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "sidebar-item",
                  active && "sidebar-item-active"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {item.path === "/notificacoes" && unreadCount > 0 && !collapsed && (
                  <span className="ml-auto text-[10px] font-bold bg-status-pending text-white px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="hidden md:flex flex-col gap-1 p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="sidebar-item w-full justify-center text-status-pending"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-item w-full justify-center"
          >
            <ChevronLeft
              className={cn(
                "w-5 h-5 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card flex-shrink-0">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {navItems.find((i) => i.path === location.pathname)?.label || "Sistema"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {roles.length > 1 && activeRole && (
              <Select value={activeRole} onValueChange={setActiveRole}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Link
              to="/notificacoes"
              className="relative p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-status-pending text-white rounded-full px-1">
                  {unreadCount}
                </span>
              )}
            </Link>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xs font-semibold text-primary-foreground">
                {(() => {
                  const name = user?.user_metadata?.nome_guerra || user?.email?.split('@')[0] || "U";
                  const parts = name.trim().split(/[.\s]/);
                  if (parts.length >= 2) {
                    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                  }
                  return name.slice(0, 2).toUpperCase();
                })()}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      <NotificationDaemon />
    </div>
  );
}
