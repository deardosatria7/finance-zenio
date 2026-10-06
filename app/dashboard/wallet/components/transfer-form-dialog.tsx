"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";

import { TransferFormSchema, type WalletPilihan } from "@/lib/types";
import { AddTransfer } from "@/lib/actions/wallets";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TransferFormProps = {
  // Hanya wallet aktif; transfer dari/ke wallet arsip ditolak service
  wallets: WalletPilihan[];
};

export function TransferFormDialog({ wallets }: TransferFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={wallets.length < 2}
        title={
          wallets.length < 2
            ? "Butuh minimal dua wallet aktif"
            : "Pindahkan uang antar wallet"
        }
      >
        <ArrowLeftRight className="w-4 h-4" />
        Transfer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Antar Wallet</DialogTitle>
          </DialogHeader>
          <TransferForm wallets={wallets} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransferForm({
  wallets,
  onSuccess,
}: TransferFormProps & { onSuccess: () => void }) {
  const router = useRouter();
  const dariDefault = wallets.find((w) => w.isDefault) ?? wallets[0];
  const form = useForm<z.infer<typeof TransferFormSchema>>({
    resolver: zodResolver(TransferFormSchema),
    defaultValues: {
      dari_wallet_id: dariDefault?.id,
      ke_wallet_id: wallets.find((w) => w.id !== dariDefault?.id)?.id,
      nominal: 0,
      catatan: "",
    },
  });

  async function onSubmit(values: z.infer<typeof TransferFormSchema>) {
    try {
      const hasil = await AddTransfer(values);
      if (hasil.error) {
        toast.error(hasil.error);
        return;
      }

      toast.success("Transfer dicatat");
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
        <FormDescription>
          Transfer tidak dihitung sebagai pemasukan atau pengeluaran, hanya
          memindahkan saldo.
        </FormDescription>

        <PilihWallet
          form={form}
          name="dari_wallet_id"
          label="Dari"
          wallets={wallets}
        />
        <PilihWallet
          form={form}
          name="ke_wallet_id"
          label="Ke"
          wallets={wallets}
        />

        <FormField
          control={form.control}
          name="nominal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nominal</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Masukan nominal"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="catatan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Catatan (opsional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Top up GoPay" {...field} />
              </FormControl>
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

function PilihWallet({
  form,
  name,
  label,
  wallets,
}: {
  form: ReturnType<typeof useForm<z.infer<typeof TransferFormSchema>>>;
  name: "dari_wallet_id" | "ke_wallet_id";
  label: string;
  wallets: WalletPilihan[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            onValueChange={(v) => field.onChange(Number(v))}
            defaultValue={field.value ? String(field.value) : undefined}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Pilih wallet" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {wallets.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
