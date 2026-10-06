"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Star, Trash2 } from "lucide-react";

import {
  ArsipkanWallet,
  DeleteWallet,
  PulihkanWallet,
  SetWalletDefault,
} from "@/lib/actions/wallets";
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
import { WalletFormDialog } from "./wallet-form-dialog";

type WalletActionsProps = {
  wallet: {
    id: number;
    nama: string;
    saldoAwal: number;
    isDefault: boolean;
    archived: boolean;
  };
};

export function WalletActions({ wallet }: WalletActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function jalankan(
    aksi: () => Promise<{ error?: string }>,
    pesanSukses: string,
  ) {
    if (isPending) return;

    setIsPending(true);
    try {
      const hasil = await aksi();
      if (hasil.error) {
        toast.error(hasil.error);
        return;
      }
      toast.success(pesanSukses);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi error!");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <WalletFormDialog wallet={wallet} />

      {/* Wallet default hanya bisa diedit; pindahkan default dulu untuk mengarsipkan/menghapusnya */}
      {!wallet.isDefault && !wallet.archived && (
        <Button
          variant="outline"
          size="icon"
          disabled={isPending}
          aria-label="Jadikan default"
          title="Jadikan default"
          onClick={() =>
            jalankan(
              () => SetWalletDefault(wallet.id),
              `${wallet.nama} sekarang wallet default`,
            )
          }
        >
          <Star className="h-4 w-4" />
        </Button>
      )}

      {!wallet.isDefault &&
        (wallet.archived ? (
          <Button
            variant="outline"
            size="icon"
            disabled={isPending}
            aria-label="Pulihkan wallet"
            title="Pulihkan"
            onClick={() =>
              jalankan(() => PulihkanWallet(wallet.id), "Wallet dipulihkan")
            }
          >
            <ArchiveRestore className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            disabled={isPending}
            aria-label="Arsipkan wallet"
            title="Arsipkan"
            onClick={() =>
              jalankan(() => ArsipkanWallet(wallet.id), "Wallet diarsipkan")
            }
          >
            <Archive className="h-4 w-4" />
          </Button>
        ))}

      {!wallet.isDefault && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              disabled={isPending}
              aria-label="Hapus wallet"
              title="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus wallet {wallet.nama}?</AlertDialogTitle>
              <AlertDialogDescription>
                Hanya wallet tanpa transaksi yang bisa dihapus. Wallet yang
                sudah punya transaksi diarsipkan saja.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  jalankan(() => DeleteWallet(wallet.id), "Wallet dihapus")
                }
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Ya, hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
