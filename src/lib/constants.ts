export const STATUS_MARKER_COLORS = {
  regional: "#eab308",       // Amarelo
  aguardando_retorno: "#f97316", // Laranja
  atribuido: "#8b5cf6",     // Roxo
  pendencias: "#ef4444",    // Vermelho
  certificado_termo: "#3b82f6", // Azul
  certificado: "#10b981",   // Verde
  expirado: "#4b5563",      // Cinza escuro
} as const;

export const REGIONAL_COLORS = [
  "border-l-blue-500", "border-l-emerald-500", "border-l-amber-500", "border-l-violet-500",
  "border-l-rose-500", "border-l-cyan-500", "border-l-orange-500", "border-l-teal-500",
  "border-l-pink-500", "border-l-indigo-500", "border-l-lime-500", "border-l-fuchsia-500",
  "border-l-sky-500", "border-l-red-500",
];

export const REGIONAL_BG_COLORS = [
  "bg-blue-500/15", "bg-emerald-500/15", "bg-amber-500/15", "bg-violet-500/15",
  "bg-rose-500/15", "bg-cyan-500/15", "bg-orange-500/15", "bg-teal-500/15",
  "bg-pink-500/15", "bg-indigo-500/15", "bg-lime-500/15", "bg-fuchsia-500/15",
  "bg-sky-500/15", "bg-red-500/15",
];

export const REGIONAL_DOT_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
  "bg-pink-500", "bg-indigo-500", "bg-lime-500", "bg-fuchsia-500",
  "bg-sky-500", "bg-red-500",
];

export const STATUS_LABELS = {
  regional: "Aguardando vistoria",
  vistoria: "Em Vistoria",
  relatorio: "Relatório",
  certificado: "Certificado",
  certificado_termo: "Cert. Provisório",
  expirado: "Expirado",
  pendencias: "Pendência",
  atribuido: "Atribuído",
} as const;
