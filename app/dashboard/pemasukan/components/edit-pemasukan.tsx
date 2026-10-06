"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  EditPemasukanSchema,
  KATEGORI_PEMASUKAN,
  type WalletPilihan,
} from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
import { EditPemasukan } from "@/lib/actions/finances";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

type EditPemasukanFormProps = {
  // wallet_id null untuk transaksi yang belum punya wallet (sebelum migrasi B)
  data: Omit<z.infer<typeof EditPemasukanSchema>, "wallet_id"> & {
    wallet_id: number | null;
  };
  wallets: WalletPilihan[];
  onSuccess?: () => void;
};

export function ButtonEditPemasukan({
  data,
  wallets,
  onSuccess,
}: EditPemasukanFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="hover:cursor-pointer"
        variant={"outline"}
      >
        <Pencil />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pemasukan</DialogTitle>
          </DialogHeader>
          <EditPemasukanForm
            data={data}
            wallets={wallets}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditPemasukanForm({
  data,
  wallets,
  onSuccess,
}: EditPemasukanFormProps) {
  const [loadingStates, setLoadingStates] = useState({ isSubmitting: false });
  const router = useRouter();
  const form = useForm<z.infer<typeof EditPemasukanSchema>>({
    resolver: zodResolver(EditPemasukanSchema),
    defaultValues: {
      ...data,
      // Wallet arsip tidak ada di pilihan, jadi user diminta memilih wallet aktif
      wallet_id: wallets.find((w) => w.id === data.wallet_id)?.id,
    },
  });

  async function onSubmit(values: z.infer<typeof EditPemasukanSchema>) {
    try {
      setLoadingStates((prev) => ({ ...prev, isSubmitting: true }));
      await EditPemasukan(values);
      toast.success("Berhasil mengedit pemasukan!");
      onSuccess?.();
      form.reset();
      router.refresh();
    } catch (error) {
      console.log(error);
      toast.error(error instanceof Error ? error.message : "Terjadi error!");
    } finally {
      setLoadingStates((prev) => ({ ...prev, isSubmitting: false }));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormDescription>
          Isi form berikut untuk mengedit data pemasukan.
        </FormDescription>

        <FormField
          control={form.control}
          name="nama_pemasukan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Pemasukan</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Gaji bulanan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="kategori"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kategori</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {KATEGORI_PEMASUKAN.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="wallet_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wallet</FormLabel>
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

        <Button
          type="submit"
          className="w-full"
          disabled={loadingStates.isSubmitting}
        >
          {loadingStates.isSubmitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>
    </Form>
  );
}
