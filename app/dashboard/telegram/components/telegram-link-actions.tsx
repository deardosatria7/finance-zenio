"use client";

import { Button } from "@/components/ui/button";
import { CreateTelegramLink, UnlinkTelegram } from "@/lib/actions/telegram";
import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function TelegramLinkActions({ linked }: { linked: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deepLink, setDeepLink] = useState<string | null>(null);

  function handleCreateLink() {
    startTransition(async () => {
      try {
        setDeepLink(await CreateTelegramLink());
      } catch (error) {
        console.error(error);
        toast.error("Gagal membuat link Telegram!");
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      try {
        await UnlinkTelegram();
        toast.success("Telegram berhasil diputus");
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error("Gagal memutus Telegram!");
      }
    });
  }

  if (linked) {
    return (
      <Button
        variant="destructive"
        onClick={handleUnlink}
        disabled={isPending}
        className="w-fit"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Putuskan Telegram
      </Button>
    );
  }

  // Link ditampilkan sebagai tombol, bukan window.open setelah await: browser memblokir popup
  // yang tidak langsung dipicu klik
  if (deepLink) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Buka link ini lalu tekan <b>Start</b> di Telegram. Link berlaku 10
          menit.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="w-fit">
            <a href={deepLink} target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4" />
              Buka Telegram
            </a>
          </Button>
          <Button variant="outline" onClick={() => router.refresh()}>
            Sudah, cek status
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button onClick={handleCreateLink} disabled={isPending} className="w-fit">
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Hubungkan Telegram
    </Button>
  );
}
