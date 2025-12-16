"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        await authClient.signOut();
        toast.success("Berhasil logout");
        router.push("/auth");
        router.refresh(); // 🔥 penting untuk sync session
      } catch {
        toast.error("Gagal logout");
      }
    });
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isPending}
      className="rounded-md px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 hover:cursor-pointer"
    >
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
