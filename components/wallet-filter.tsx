"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Wallet } from "@/lib/types";

export default function WalletFilter({
  wallets,
}: {
  wallets: Pick<Wallet, "id" | "nama">[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const wallet = searchParams.get("wallet") ?? "";

  function updateWallet(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set("wallet", value);
    } else {
      params.delete("wallet");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={wallet || "all"} onValueChange={updateWallet}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="Semua wallet" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Semua wallet</SelectItem>
        {wallets.map((w) => (
          <SelectItem key={w.id} value={String(w.id)}>
            {w.nama}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
