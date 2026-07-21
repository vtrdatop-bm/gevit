import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Agendamento {
  id: string;
  numero: string;
  nome_fantasia: string;
  razao_social: string;
  data_agendamento: string;
}

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchAgendamentos() {
      setLoading(true);
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from("protocolos")
        .select("id, numero, nome_fantasia, razao_social, data_agendamento")
        .eq("agendar", true)
        .gte("data_agendamento", startStr)
        .lte("data_agendamento", endStr)
        .order("data_agendamento", { ascending: true });

      if (error) {
        console.error("Erro ao buscar agendamentos:", error);
      } else {
        setAgendamentos(data || []);
      }
      setLoading(false);
    }
    
    fetchAgendamentos();
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Build calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border border-border overflow-hidden m-4">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h1>
            <p className="text-sm text-muted-foreground">Calendário de Agendamentos</p>
          </div>
        </div>
        
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
            Hoje
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {weekDays.map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-muted/10 p-2">
        <div className="grid grid-cols-7 gap-2 auto-rows-fr h-full min-h-[600px]">
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayAgendamentos = agendamentos.filter(a => a.data_agendamento === dayKey);
            
            return (
              <div 
                key={dayKey}
                className={cn(
                  "bg-card border rounded-md p-1.5 flex flex-col gap-1 overflow-hidden min-h-[100px]",
                  !isSameMonth(day, monthStart) ? "opacity-40 bg-muted/50" : "",
                  isToday(day) ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={cn(
                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {format(day, dateFormat)}
                  </span>
                  {dayAgendamentos.length > 0 && (
                    <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 rounded">
                      {dayAgendamentos.length}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {dayAgendamentos.map(a => (
                    <div
                      key={a.id}
                      onClick={() => navigate(`/protocolo/${a.id}`)}
                      className="text-[10px] leading-tight p-1.5 bg-green-50/50 border border-green-200/60 hover:bg-green-100/50 hover:border-green-300 rounded cursor-pointer transition-colors break-words group"
                      title={`${a.numero} - ${a.nome_fantasia || a.razao_social}`}
                    >
                      <div className="font-bold text-green-800 group-hover:text-green-900">{a.numero}</div>
                      <div className="text-muted-foreground truncate">{a.nome_fantasia || a.razao_social}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
