"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PemasukanFormSchema } from "@/lib/types";

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
import { AddNewPemasukan } from "@/lib/actions/finances";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type AddNewPemasukanFormProps = {
  onSuccess?: () => void;
};

type ButtonAddNewPengeluaranProps = {
  small_ver?: boolean;
};

export function ButtonAddNewPemasukan({
  small_ver = false,
}: ButtonAddNewPengeluaranProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {small_ver ? (
        <Button
          onClick={() => setOpen(true)}
          variant={"default"}
          className="bg-green-600 text-white hover:bg-green-400 hover:cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="bg-green-600 text-white hover:bg-green-400 hover:cursor-pointer"
        >
          Tambah baru
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pemasukan</DialogTitle>
          </DialogHeader>
          <AddNewPemasukanForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddNewPemasukanForm({ onSuccess }: AddNewPemasukanFormProps) {
  const [loadingStates, setLoadingStates] = useState({ isSubmitting: false });
  const router = useRouter();
  const form = useForm<z.infer<typeof PemasukanFormSchema>>({
    resolver: zodResolver(PemasukanFormSchema),
    defaultValues: {
      nama_pemasukan: "",
      nominal: 0,
    },
  });

  async function onSubmit(values: z.infer<typeof PemasukanFormSchema>) {
    // TODO: API / server action
    try {
      setLoadingStates((prev) => ({ ...prev, isSubmitting: true }));
      await AddNewPemasukan(values);
      toast.success("Berhasil menambahkan pemasukan!");
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
          Isi form berikut untuk menambahkan data pemasukan baru.
        </FormDescription>
        {/* Nama Pemasukan */}
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

        {/* Nominal */}
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
          {loadingStates.isSubmitting ? "Meyimpan..." : "Simpan"}
        </Button>
      </form>
    </Form>
  );
}
