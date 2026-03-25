import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { label: "Todos", value: "all" },
  { label: "Hoje", value: "today" },
  { label: "Dia específico", value: "single_day" },
  { label: "Mês atual", value: "this_month" },
  { label: "Mês passado", value: "last_month" },
  { label: "Últimos 3 meses", value: "last_3_months" },
  { label: "Últimos 6 meses", value: "last_6_months" },
  { label: "Este ano", value: "this_year" },
  { label: "Personalizado", value: "custom" },
];

function getPresetRange(preset: string): DateRange {
  const now = new Date();
  switch (preset) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { from: start, to: end };
    }
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month": {
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    }
    case "last_3_months":
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case "last_6_months":
      return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: undefined, to: undefined };
  }
}

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [preset, setPreset] = useState("all");

  const handlePreset = (val: string) => {
    setPreset(val);
    if (val !== "custom" && val !== "single_day") {
      onChange(getPresetRange(val));
    }
  };

  const handleSingleDay = (d: Date | undefined) => {
    if (d) {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      onChange({ from: start, to: end });
    }
  };

  const formatRange = () => {
    if (!value.from) return null;
    const f = format(value.from, "dd/MM/yyyy");
    const t = value.to ? format(value.to, "dd/MM/yyyy") : "...";
    return `${f} – ${t}`;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={handlePreset}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "single_day" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-2", !value.from && "text-muted-foreground")}>
              <CalendarIcon className="w-4 h-4" />
              {value.from ? format(value.from, "dd/MM/yyyy") : "Selecionar dia"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.from}
              onSelect={handleSingleDay}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-2", !value.from && "text-muted-foreground")}>
                <CalendarIcon className="w-4 h-4" />
                {value.from ? format(value.from, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.from}
                onSelect={(d) => onChange({ ...value, from: d })}
                locale={ptBR}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-2", !value.to && "text-muted-foreground")}>
                <CalendarIcon className="w-4 h-4" />
                {value.to ? format(value.to, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.to}
                onSelect={(d) => onChange({ ...value, to: d })}
                locale={ptBR}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {value.from && preset !== "custom" && (
        <span className="text-xs text-muted-foreground">{formatRange()}</span>
      )}
    </div>
  );
}
