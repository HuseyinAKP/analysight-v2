import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(value: number, decimals = 2): string {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${fmt(value)}%`;
}

export function fmtCurrency(value: number, currency = "TRY"): string {
  return value.toLocaleString("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 });
}
