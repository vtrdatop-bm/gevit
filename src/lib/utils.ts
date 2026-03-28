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
  
  // 1. Remove pontos de milhar para processar os dígitos limpos
  const clean = value.replace(/\./g, "");
  
  // 2. Se não tem vírgula, tratamos como inteiro puro + ,00
  if (!clean.includes(",")) {
    const digits = clean.replace(/\D/g, "");
    if (!digits) return "";
    const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedInt},00`;
  }
  
  // 3. Se tem vírgula, o usuário está definindo os decimais
  const parts = clean.split(",");
  let intPart = parts[0].replace(/\D/g, "");
  let decPart = parts[1].replace(/\D/g, "");
  
  // Lógica de substituição inteligente:
  // Se tínhamos ",00" e o usuário digitou um número (ex: 3075,001)
  if (decPart.startsWith("00") && decPart.length > 2) {
    decPart = decPart.slice(2); // Remove os zeros automáticos antigos
  } 
  // Se digitou algo por cima (ex: 3075,106 -> removemos o 0 do meio para ficar 3075,16)
  else if (decPart.length > 2) {
    decPart = decPart.replace(/0/, ""); // Remove o primeiro zero encontrado
  }
  
  // Trata Backspace nos decimais: se ficou vazio ou com apenas "0" quer dizer que o usuário 
  // está apagando. Devolvemos o inteiro "limpo" para o próximo passo.
  if (parts.length > 1 && (decPart === "" || decPart === "0") && !value.endsWith(",00")) {
    intPart = intPart.slice(0, -1);
    decPart = "";
  }

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  // Garante sempre 2 casas decimais no retorno (ex: ,1 -> ,10)
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

