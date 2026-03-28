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
  if (!value) return "";
  
  // 1. Limpeza de pontos de milhar prévios para não confundir a lógica
  // Remove pontos que estão entre números (ex: 1.000 -> 1000)
  let clean = value.replace(/(\d)\.(\d{3})/g, "$1$2");
  clean = clean.replace(/(\d)\.(\d{3})/g, "$1$2"); // Segunda passada para milhões
  
  // 2. Normalização: Ponto vira vírgula para processamento
  clean = clean.replace(/\./g, ",");
  
  const parts = clean.split(",");
  const intPart = parts[0].replace(/\D/g, "");
  let decPart = parts.length > 1 ? parts.slice(1).join("").replace(/\D/g, "") : null;

  // 3. Lógica de Backspace nos decimais
  if (parts.length > 1 && (decPart === "" || decPart === "0") && !value.endsWith(",00")) {
    const parentInt = intPart.slice(0, -1);
    const fmtInt = parentInt.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parentInt.length > 0 ? `${fmtInt},00` : "";
  }

  // 4. Inserção após ,00 automático (ex: 123,00 + 4)
  if (decPart && decPart.startsWith("00") && decPart.length > 2) {
    decPart = decPart.slice(2);
  }

  // 5. Formatação do Inteiro
  const fmtInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  // Se não tem vírgula, assume inteiro + ,00
  if (decPart === null) {
    return intPart.length > 0 ? `${fmtInt},00` : "";
  }

  // 6. Formatação dos Decimais
  // Se o usuário está digitando (ex: 18,5), não completa o zero ainda para permitir backspace
  if (decPart.length === 1 && !value.endsWith("0")) {
    const finalInt = intPart.length > 0 ? fmtInt : "0";
    return `${finalInt},${decPart}`;
  }

  const finalDec = decPart.slice(0, 2).padEnd(2, "0");
  const finalInt = intPart.length > 0 ? fmtInt : "0";
  return `${finalInt},${finalDec}`;
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

