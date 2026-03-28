/**
 * Shared constants for the GEVIT application.
 */

export const STATUS_LABELS: Record<string, string> = {
  regional: "Aguardando Vistoria",
  atribuido: "Atribuído",
  pendencias: "Vistoria com Pendência",
  certificado_termo: "Certificado Provisório",
  certificado: "Certificado",
  expirado: "Expirados",
};

export const STATUS_LABELS_SHORT: Record<string, string> = {
  certificado: "Certificado",
  certificado_termo: "Cert. Provisório",
  pendencias: "Pendência",
  expirado: "Expirados",
};

export const STAGE_LABELS = ["1ª Vistoria", "2ª Vistoria", "3ª Vistoria"];

export const BAR_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
  "hsl(270, 60%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 80%, 42%)",
  "hsl(340, 82%, 52%)",
  "hsl(25, 95%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 70%, 50%)",
  "hsl(120, 50%, 40%)",
  "hsl(60, 70%, 45%)",
  "hsl(310, 60%, 50%)",
];

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

export const STATUS_MARKER_COLORS: Record<string, string> = {
  regional: "#eab308",
  atribuido: "#8b5cf6",
  pendencias: "#ef4444",
  certificado_termo: "#3b82f6",
  certificado: "#22c55e",
  expirado: "#737373",
};

