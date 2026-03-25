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
  // Remove anything that is not a digit
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  
  // Convert to number (last 2 digits are decimals)
  const num = (parseInt(digits, 10) / 100).toFixed(2);
  const [int, dec] = num.split(".");
  
  // Add thousands separator (dot)
  const formattedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  return `${formattedInt},${dec}`;
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
