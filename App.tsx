import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import KanbanPage from "@/pages/KanbanPage";
import MapPage from "@/pages/MapPage";
import ImportPage from "@/pages/ImportPage";
import RoutesPage from "@/pages/RoutesPage";
import InspectionsPage from "@/pages/InspectionsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SettingsPage from "@/pages/SettingsPage";
import CadastroProtocoloPage from "@/pages/CadastroProtocoloPage";
import ProtocolosPage from "@/pages/ProtocolosPage";
import ProtocoloDetailPage from "@/pages/ProtocoloDetailPage";
import LoginPage from "@/pages/LoginPage";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRoleLoading(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role || null);
        setRoleLoading(false);
      });
  }, [user]);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isVistoriador = role === "vistoriador";

  return (
    <AppLayout>
      <Routes>
        {isVistoriador ? (
          <Route path="/" element={<Navigate to="/vistorias" replace />} />
        ) : (
          <Route path="/" element={<DashboardPage />} />
        )}
        {!isVistoriador && <Route path="/kanban" element={<KanbanPage />} />}
        <Route path="/mapa" element={<MapPage />} />
        {!isVistoriador && <Route path="/protocolos" element={<ProtocolosPage />} />}
        {!isVistoriador && <Route path="/cadastro-protocolo" element={<CadastroProtocoloPage />} />}
        {!isVistoriador && <Route path="/protocolo/:id" element={<ProtocoloDetailPage />} />}
        {!isVistoriador && <Route path="/importar" element={<ImportPage />} />}
        <Route path="/rotas" element={<RoutesPage />} />
        <Route path="/vistorias" element={<InspectionsPage />} />
        <Route path="/notificacoes" element={<NotificationsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={isVistoriador ? <Navigate to="/vistorias" replace /> : <NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
