"use client";

import { Button } from "@/components/ui/button";
import { CreateWhatsappLink, UnlinkWhatsapp } from "@/lib/actions/whatsapp";
import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function WhatsappLinkActions({ linked }: { linked: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [waLink, setWaLink] = useState<string | null>(null);

  function handleCreateLink() {
    startTransition(async () => {
      try {
        setWaLink(await CreateWhatsappLink());
      } catch (error) {
        console.error(error);
        toast.error("Gagal membuat link WhatsApp!");
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      try {
        await UnlinkWhatsapp();
        toast.success("WhatsApp berhasil diputus");
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error("Gagal memutus WhatsApp!");
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
        Putuskan WhatsApp
      </Button>
    );
  }

  // Link ditampilkan sebagai tombol, bukan window.open setelah await: browser memblokir popup
  // yang tidak langsung dipicu klik
  if (waLink) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Buka link ini, lalu <b>kirim</b> pesan yang sudah terisi otomatis. Link
          berlaku 10 menit.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="w-fit">
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Buka WhatsApp
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
        <MessageCircle className="h-4 w-4" />
      )}
      Hubungkan WhatsApp
    </Button>
  );
}
