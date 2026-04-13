import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import KanbanPage from "@/pages/KanbanPage";
import MapPage from "@/pages/MapPage";

import RoutesPage from "@/pages/RoutesPage";
import InspectionsPage from "@/pages/InspectionsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SettingsPage from "@/pages/SettingsPage";
import CadastroProtocoloPage from "@/pages/CadastroProtocoloPage";
import ProtocolosPage from "@/pages/ProtocolosPage";
import ProtocoloDetailPage from "@/pages/ProtocoloDetailPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, activeRole, rolesLoading } = useAuth();

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isVistoriador = activeRole === "vistoriador";

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
        <Route path="/protocolo/:id" element={<ProtocoloDetailPage />} />

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
            <Route path="/signup" element={<SignupPage />} />
            
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
