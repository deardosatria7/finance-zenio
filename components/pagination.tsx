"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./ui/button";

export default function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function goToPage(page: number) {
    const search = new URLSearchParams(params.toString());
    search.set("page", page.toString());
    router.push(`?${search.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 mt-4">
      <Button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Prev
      </Button>
      <Button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
      <span className="text-sm">
        Page {currentPage} / {totalPages}
      </span>
    </div>
  );
}
