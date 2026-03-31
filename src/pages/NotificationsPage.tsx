import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, AlertTriangle, Clock, CheckCircle2, MessageSquare, ArrowLeft, Check, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const iconMap: Record<string, { icon: typeof Bell; color: string }> = {
  warning: { icon: AlertTriangle, color: "text-status-risk bg-status-risk/10" },
  danger: { icon: Clock, color: "text-status-pending bg-status-pending/10" },
  success: { icon: CheckCircle2, color: "text-status-certified bg-status-certified/10" },
  info: { icon: MessageSquare, color: "text-status-term bg-status-term/10" },
};

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  lida: boolean;
  created_at: string;
  processo_id: string | null;
  processo?: {
    protocolo_id: string;
  } | null;
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} dia${diffD > 1 ? "s" : ""} atrás`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function fetch() {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*, processo:processos(protocolo_id)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching notifications:", error);
      } else {
        setNotifications((data as unknown) as Notificacao[]);
      }
      setLoading(false);
    }
    fetch();
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notificacoes").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.lida).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notificacoes").update({ lida: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.lida).length;
  const unreadNotifications = notifications.filter((n) => !n.lida);
  const readNotifications = notifications.filter((n) => n.lida);

  const NotificationItem = ({ n }: { n: Notificacao }) => {
    const { icon: Icon, color } = iconMap[n.tipo] || iconMap.info;
    return (
      <div
        key={n.id}
        onClick={() => {
          if (!n.lida) markAsRead(n.id);
          if (n.processo?.protocolo_id) {
            navigate(`/protocolo/${n.processo.protocolo_id}`);
          }
        }}
        className={`kpi-card flex items-start gap-4 cursor-pointer transition-colors group ${!n.lida ? "border-l-2 border-l-primary" : ""}`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{n.titulo}</p>
          {n.descricao && (
            <p className="text-xs text-muted-foreground mt-0.5">{n.descricao}</p>
          )}
          <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
          {!n.lida && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(n.id);
              }}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              title="Marcar como lida"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNotification(n.id);
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {!n.lida && (
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2 group-hover:hidden" />
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-foreground">Notificações</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Alertas de prazos, expiração e atualizações
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      <Tabs defaultValue="unread" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="unread" className="relative">
            Não lidas
            {unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Lidas</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="mt-4 space-y-4">
          {unreadNotifications.length === 0 ? (
            <div className="kpi-card">
              <p className="text-sm text-muted-foreground py-8 text-center">
                Você não tem novas notificações.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {unreadNotifications.map((n) => (
                <NotificationItem key={n.id} n={n} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="read" className="mt-4 space-y-4">
          {readNotifications.length === 0 ? (
            <div className="kpi-card">
              <p className="text-sm text-muted-foreground py-8 text-center">
                Histórico de notificações vazio.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {readNotifications.map((n) => (
                <NotificationItem key={n.id} n={n} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
