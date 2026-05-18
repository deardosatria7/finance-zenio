"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { KATEGORI_PENGELUARAN, PengeluaranFormSchema } from "@/lib/types";

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
import { AddNewPengeluaran } from "@/lib/actions/finances";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type AddNewPengeluaranFormProps = {
  onSuccess?: () => void;
};

type ButtonAddNewPengeluaranProps = {
  small_ver?: boolean;
};

export function ButtonAddNewPengeluaran({
  small_ver = false,
}: ButtonAddNewPengeluaranProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {small_ver ? (
        <Button
          onClick={() => setOpen(true)}
          variant={"default"}
          className="bg-blue-600 text-white hover:bg-blue-400 hover:cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="bg-blue-600 text-white hover:bg-blue-400 hover:cursor-pointer"
        >
          Tambah baru
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pengeluaran</DialogTitle>
          </DialogHeader>
          <AddNewPengeluaranForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddNewPengeluaranForm({
  onSuccess,
}: AddNewPengeluaranFormProps) {
  const [loadingStates, setLoadingStates] = useState({ isSubmitting: false });
  const router = useRouter();
  const form = useForm<z.infer<typeof PengeluaranFormSchema>>({
    resolver: zodResolver(PengeluaranFormSchema),
    defaultValues: {
      nama_pengeluaran: "",
      nominal: 0,
      kategori: "Lainnya",
    },
  });

  async function onSubmit(values: z.infer<typeof PengeluaranFormSchema>) {
    try {
      setLoadingStates((prev) => ({ ...prev, isSubmitting: true }));
      await AddNewPengeluaran(values);
      toast.success("Berhasil menambahkan pengeluaran!");
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
          Isi form berikut untuk menambahkan data pengeluaran baru.
        </FormDescription>

        <FormField
          control={form.control}
          name="nama_pengeluaran"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Pengeluaran</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Pulsa dan internet" {...field} />
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
                  {KATEGORI_PENGELUARAN.map((k) => (
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
