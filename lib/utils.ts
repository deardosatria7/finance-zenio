import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**Function untuk format rupiah */
export function formatRupiah(value: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value));
}

/**Function untuk format timestampz */
export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/**Rentang tanggal filter bulan/tahun; dateTo eksklusif, bulan tanpa tahun memakai tahun berjalan */
export function getDateRange(
  month: number | null,
  year: number | null,
): { dateFrom: Date | null; dateTo: Date | null } {
  if (month && year) {
    return {
      dateFrom: new Date(year, month - 1, 1),
      dateTo: new Date(year, month, 1),
    };
  }
  if (year) {
    return { dateFrom: new Date(year, 0, 1), dateTo: new Date(year + 1, 0, 1) };
  }
  if (month) {
    const thisYear = new Date().getFullYear();
    return {
      dateFrom: new Date(thisYear, month - 1, 1),
      dateTo: new Date(thisYear, month, 1),
    };
  }
  return { dateFrom: null, dateTo: null };
}
