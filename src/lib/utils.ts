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
 * Formats an input string with thousands separator and comma.
 * To be used in onChange events.
 */
export function applyAreaMask(value: string): string {
  // Remove tudo que não é dígito
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  
  // Lógica solicitada:
  // - Se tem 1 ou 2 dígitos: são a parte inteira (ex: 5 -> 5,00 / 50 -> 50,00)
  // - Se tem 3 ou mais: os dígitos após o 2º começam a preencher os decimais (ex: 455 -> 45,50 / 13552 -> 135,52)
  
  // O ponto decimal começa após o 2º dígito ou (comprimento - 2) para números grandes
  const decimalStart = Math.max(2, digits.length - 2);
  
  const intPart = digits.slice(0, decimalStart);
  let decPart = digits.slice(decimalStart).slice(0, 2); // máximo 2 casas
  
  // Preenche com zeros se necessário (ex: 455 -> 45,5 -> 45,50)
  decPart = decPart.padEnd(2, "0");
  
  // Formata o inteiro com separador de milhar (ponto)
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  return `${formattedInt},${decPart}`;
}

/**
 * Returns a number from a masked string.
 * Example: "1.234,56" -> 1234.56
 */
export function parseAreaToNumber(value: string): number {
  if (!value) return 0;
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

