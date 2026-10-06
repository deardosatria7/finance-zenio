"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Trash2 } from "lucide-react";

import { DeleteTransfer } from "@/lib/actions/wallets";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type BarisTransfer = {
  id: number;
  createdAt: Date;
  nominal: number;
  catatan: string | null;
  dariNama: string;
  keNama: string;
};

export function TransferList({ transfers }: { transfers: BarisTransfer[] }) {
  if (transfers.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada transfer.</p>;
  }

  return (
    <ul className="flex flex-col divide-y border rounded-xl">
      {transfers.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 font-medium">
              {t.dariNama}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {t.keNama}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {new Date(t.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {t.catatan && ` · ${t.catatan}`}
            </div>
          </div>
          <span className="font-semibold whitespace-nowrap">
            {formatRupiah(t.nominal)}
          </span>
          <TombolHapus transfer={t} />
        </li>
      ))}
    </ul>
  );
}

function TombolHapus({ transfer }: { transfer: BarisTransfer }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function hapus() {
    setIsPending(true);
    try {
      const hasil = await DeleteTransfer(transfer.id);
      if (hasil.error) {
        toast.error(hasil.error);
        return;
      }
      toast.success("Transfer dihapus");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi error!");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          aria-label="Hapus transfer"
          title="Hapus"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus transfer ini?</AlertDialogTitle>
          <AlertDialogDescription>
            {`${formatRupiah(transfer.nominal)} akan kembali ke ${transfer.dariNama}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={hapus}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ya, hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
