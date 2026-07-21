import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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
            <h1 className="text-xl font-bold text-foreground">
              Agendamentos
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{format(currentDate, "MMMM yyyy", { locale: ptBR })}</p>
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
                onClick={() => {
                  if (dayAgendamentos.length > 0) setSelectedDay(day);
                }}
                className={cn(
                  "bg-card border rounded-md p-1.5 flex flex-col gap-1 overflow-hidden min-h-[100px]",
                  !isSameMonth(day, monthStart) ? "opacity-40 bg-muted/50" : "",
                  isToday(day) ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
                  dayAgendamentos.length > 0 && "cursor-pointer hover:border-primary/50 transition-colors"
                )}
              >
                <div className="flex justify-between items-start w-full">
                  <span className={cn(
                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {format(day, dateFormat)}
                  </span>
                </div>
                {dayAgendamentos.length > 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center pb-2">
                    <span className="text-4xl font-black text-green-600 leading-none">
                      {dayAgendamentos.length}
                    </span>
                    <span className="text-xs font-semibold text-green-700 mt-1 uppercase tracking-wider">
                      {dayAgendamentos.length === 1 ? "Vistoria" : "Vistorias"}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Agendamentos para {selectedDay ? format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-4 pr-2">
            {selectedDay && agendamentos
              .filter(a => a.data_agendamento === format(selectedDay, "yyyy-MM-dd"))
              .map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/protocolo/${a.id}`)}
                  className="flex flex-col p-3 border rounded-md cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-foreground text-sm">{a.numero}</span>
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                      Agendado
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">{a.nome_fantasia || a.razao_social}</span>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
