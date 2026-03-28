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
  
  // 1. Identifica a ÚLTIMA pontuação (. ou ,) para decidir o que é decimal
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  const lastPuncIdx = Math.max(lastComma, lastDot);
  
  let intDigits = "";
  let decDigits = "";

  if (lastPuncIdx === -1) {
    // Sem pontuação: trate tudo como inteiro
    intDigits = value.replace(/\D/g, "");
    decDigits = "00";
  } else {
    // Heurística: se a pontuação for vírgula, OU for um ponto seguido de 1, 2 ou >3 dígitos, é decimal.
    // Se for ponto seguido de EXATAMENTE 3 dígitos, é milhar (gerado pela máscara).
    const distFromRight = value.length - 1 - lastPuncIdx;
    const isManualTrigger = value.endsWith(".") || value.endsWith(",");
    const isDecimal = isManualTrigger || value[lastPuncIdx] === "," || distFromRight !== 3;

    if (isDecimal) {
      intDigits = value.slice(0, lastPuncIdx).replace(/\D/g, "");
      decDigits = value.slice(lastPuncIdx + 1).replace(/\D/g, "");
    } else {
      // Provável ponto de milhar gerado pela máscara (ex: 3.075)
      intDigits = value.replace(/\D/g, "");
      decDigits = "00";
    }
  }

  // 2. Limpeza de sufixo automático (ex: 18,00 + 5 -> decDigits "005" -> Queremos "5")
  if (decDigits.startsWith("00") && decDigits.length > 2) {
    decDigits = decDigits.slice(2);
  }
  
  // 3. Lógica de Backspace nos decimais (para não travar)
  // Se o usuário apagou um dos zeros ou a vírgula (ex: "185,0")
  if (value.includes(",") && (decDigits === "" || decDigits === "0") && !value.endsWith(",00")) {
    intDigits = intDigits.slice(0, -1);
    decDigits = "00";
  }

  if (!intDigits) return "";

  // 4. Formata Inteiro com ponto
  const formattedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  // 5. Formata Decimais com vírgula e 2 casas
  // Se o usuário acabou de digitar a primeira casa decimal (ex: 18,5), não completamos o zero 
  // imediatamente SE ele ainda estiver editando, para permitir o backspace.
  if (decDigits.length === 1 && !value.endsWith("0")) {
    return `${formattedInt},${decDigits}`;
  }

  const finalDec = decDigits.slice(0, 2).padEnd(2, "0");
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

