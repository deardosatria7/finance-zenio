"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface searchBarProps {
  withPagination?: boolean;
}

export function SearchBar({ withPagination = true }: searchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    const trimmed = search.trim();

    if (!trimmed) {
      toast.error("Masukkan sesuatu di kolom pencarian!", {
        description: "Kolom pencarian tidak boleh kosong.",
        duration: 3000,
      });
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("search", trimmed);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex w-full max-w-md items-center space-x-2">
      <Input
        placeholder="Cari sesuatu..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        className="text-sm"
      />
      <Button type="button" onClick={handleSearch} disabled={isPending}>
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default SearchBar;
