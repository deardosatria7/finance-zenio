"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

import { WalletFormSchema } from "@/lib/types";
import { AddWallet, EditWallet } from "@/lib/actions/wallets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type WalletFormDialogProps = {
  // Kosong = tambah wallet baru
  wallet?: { id: number; nama: string; saldoAwal: number };
};

export function WalletFormDialog({ wallet }: WalletFormDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {wallet ? (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Edit wallet"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="bg-green-600 text-white hover:bg-green-400 hover:cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tambah wallet
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {wallet ? "Edit Wallet" : "Tambah Wallet"}
            </DialogTitle>
          </DialogHeader>
          <WalletForm wallet={wallet} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function WalletForm({
  wallet,
  onSuccess,
}: WalletFormDialogProps & { onSuccess: () => void }) {
  const router = useRouter();
  const form = useForm<z.infer<typeof WalletFormSchema>>({
    resolver: zodResolver(WalletFormSchema),
    defaultValues: {
      nama: wallet?.nama ?? "",
      saldo_awal: wallet?.saldoAwal ?? 0,
    },
  });

  async function onSubmit(values: z.infer<typeof WalletFormSchema>) {
    try {
      const hasil = wallet
        ? await EditWallet({ ...values, id: wallet.id })
        : await AddWallet(values);

      if (hasil.error) {
        toast.error(hasil.error);
        return;
      }

      toast.success(wallet ? "Wallet diperbarui" : "Wallet ditambahkan");
      onSuccess();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi error!");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nama"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Wallet</FormLabel>
              <FormControl>
                <Input placeholder="e.g. BCA, GoPay, Cash" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="saldo_awal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Saldo Awal</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </FormControl>
              <FormDescription>
                Uang yang sudah ada di wallet ini sebelum mulai dicatat.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>
    </Form>
  );
}
