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
  
  // 1. Normalização: Se o usuário digitou ponto no final ou em algum lugar que pareça decimal, 
  // tratamos como vírgula para respeitar a intenção de "casa decimal".
  let normalized = value;
  // Se o usuário digitou um ponto ou vírgula no final bruto da string
  if (value.endsWith(".") || value.endsWith(",")) {
    normalized = value.slice(0, -1) + ",";
  }

  // Se houver um ponto que NÃO parece milhar (não tem 3 dígitos depois dele), convertemos para vírgula
  // Ex: 3075.1 -> 3075,1
  const points = normalized.match(/\./g) || [];
  if (points.length === 1 && !normalized.includes(",")) {
    const parts = normalized.split(".");
    if (parts[1].length < 3) {
      normalized = parts[0] + "," + parts[1];
    }
  }

  // 2. Limpeza de pontos de milhar remanescentes
  const clean = normalized.replace(/\./g, "");
  const parts = clean.split(",");
  let intPart = parts[0].replace(/\D/g, "");
  let decPart = parts.length > 1 ? parts[1].replace(/\D/g, "") : null;

  // 3. Backspace em decimais
  if (clean.includes(",") && (decPart === "" || decPart === "0") && !normalized.endsWith(",00")) {
    intPart = intPart.slice(0, -1);
    const fmtInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return intPart ? `${fmtInt},00` : "";
  }

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decPart === null) {
    return `${formattedInt},00`;
  }

  // 4. Inserção após ,00 automático
  if (decPart.startsWith("00") && decPart.length > 2) {
    decPart = decPart.slice(2);
    const combined = intPart + decPart;
    const finalInt = combined.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${finalInt},00`;
  }

  // 5. Backspace suave nos decimais
  if (decPart.length === 1 && !normalized.endsWith("0")) {
    return `${formattedInt},${decPart}`;
  }

  const finalDec = decPart.slice(0, 2).padEnd(2, "0");
  return `${formattedInt},${finalDec}`;
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

