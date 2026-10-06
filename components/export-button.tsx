"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportButtonProps {
  type: "pemasukan" | "pengeluaran";
  month?: number;
  year?: number;
  wallet?: number;
}

export default function ExportButton({
  type,
  month,
  year,
  wallet,
}: ExportButtonProps) {
  function handleExport() {
    const params = new URLSearchParams({ type });
    if (month) params.set("month", String(month));
    if (year) params.set("year", String(year));
    if (wallet) params.set("wallet", String(wallet));
    window.location.href = `/api/export?${params.toString()}`;
  }

  return (
    <Button variant="outline" onClick={handleExport} className="gap-2">
      <Download className="w-4 h-4" />
      Export CSV
    </Button>
  );
}
