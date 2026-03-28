export const STATUS_MARKER_COLORS = {
  regional: "#3b82f6", // Blue-500
  vistoria: "#f59e0b", // Amber-500
  relatorio: "#ef4444", // Red-500
  certificado: "#10b981", // Emerald-500
  certificado_termo: "#8b5cf6", // Violet-500
  expirado: "#000000", // Black
  pendencias: "#f97316", // Orange-500
  atribuido: "#6366f1", // Indigo-500
} as const;

export const REGIONAL_COLORS = [
  "border-l-blue-500",
  "border-l-teal-500",
  "border-l-indigo-500",
  "border-l-violet-500",
  "border-l-cyan-500",
  "border-l-emerald-500",
  "border-l-sky-500",
];

export const REGIONAL_BG_COLORS = [
  "bg-blue-50/50",
  "bg-teal-50/50",
  "bg-indigo-50/50",
  "bg-violet-50/50",
  "bg-cyan-50/50",
  "bg-emerald-50/50",
  "bg-sky-50/50",
];

export const REGIONAL_DOT_COLORS = [
  "bg-blue-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-sky-500",
];

export const STATUS_LABELS = {
  regional: "Aguardando",
  vistoria: "Em Vistoria",
  relatorio: "Relat├│rio",
  certificado: "Certificado",
  certificado_termo: "Cert. Provis├│rio",
  expirado: "Expirado",
  pendencias: "Pend├¬ncia",
  atribuido: "Atribu├¡do",
} as const;
