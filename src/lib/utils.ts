import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a protocol number with mask: VT9999.9999.9999-99
 * Accepts only digits as input and applies the VT prefix + separators automatically.
 */
export function formatProtocoloNumero(value: string): string {
  // Strip everything except digits
  const digits = value.replace(/\D/g, "");
  // Max 14 digits: 4.4.4-2
  const limited = digits.slice(0, 14);
  let result = "VT";
  for (let i = 0; i < limited.length; i++) {
    if (i === 4 || i === 8) result += ".";
    if (i === 12) result += "-";
    result += limited[i];
  }
  return result;
}

/**
 * Formats a number for display with dot as thousands separator and comma as decimal.
 * Example: 1234.56 -> 1.234,56
 */
export function formatArea(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return typeof value === "string" ? value : "";
  
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Sanitizes area input during typing.
 * - If the value already contains a comma (decimal separator), dots are treated as
 *   thousand separators and are stripped out.
 * - If there is no comma, a dot is treated as a decimal separator and converted to comma.
 * Always limits to 2 decimal digits.
 */
export function applyAreaMask(value: string): string {
  const hasComma = value.includes(",");

  if (hasComma) {
    // Dots are thousand separators → strip them; keep comma as decimal
    let clean = value.replace(/\./g, "").replace(/[^0-9,]/g, "");
    const firstComma = clean.indexOf(",");
    if (firstComma !== -1) {
      const intPart = clean.slice(0, firstComma);
      const decPart = clean.slice(firstComma + 1).replace(/,/g, "").slice(0, 2);
      clean = intPart + "," + decPart;
    }
    return clean;
  } else {
    // No comma: dot (if any) is the decimal separator → convert to comma
    let clean = value.replace(/[^0-9.]/g, "");
    const firstDot = clean.indexOf(".");
    if (firstDot !== -1) {
      const intPart = clean.slice(0, firstDot);
      const decPart = clean.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
      return intPart + "," + decPart;
    }
    return clean;
  }
}

/**
 * Formats the area string on blur: parses and re-formats with thousand separator
 * and always 2 decimal places.
 * Example: "1050,6" → "1.050,60", "1" → "1,00"
 */
export function formatAreaOnBlur(value: string): string {
  if (!value.trim()) return "";
  const num = parseAreaToNumber(value);
  if (isNaN(num)) return value;
  return formatArea(num);
}

/**
 * Retorna um número a partir de uma string formatada.
 * Exemplo: "1.234,00" -> 1234
 */
export function parseAreaToNumber(value: string): number {
  if (!value) return 0;
  // Remove os pontos de milhar e converte a vírgula em ponto para o JS
  const clean = value.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

/**
 * Validates a CNPJ string (check length only for simplicity of this cleanup).
 */
export function validateCNPJ(cnpj: string): boolean {
  return cnpj.replace(/\D/g, "").length === 14;
}

/**
 * Formats a CPF (11 digits) or CNPJ (14 digits) string.
 */
export function formatCpfCnpj(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return val;
}

