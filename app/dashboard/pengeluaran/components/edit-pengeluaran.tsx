"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EditPengeluaranSchema } from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { EditPengeluaran } from "@/lib/actions/finances";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

type EditPengeluaranFormProps = {
  data: z.infer<typeof EditPengeluaranSchema>;
  onSuccess?: () => void;
};

export function ButtonEditPengeluaran({
  data,
  onSuccess,
}: EditPengeluaranFormProps) {
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
            <DialogTitle>Edit Pengeluaran</DialogTitle>
          </DialogHeader>

          <EditPengeluaranForm data={data} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditPengeluaranForm({
  data,
  onSuccess,
}: EditPengeluaranFormProps) {
  const [loadingStates, setLoadingStates] = useState({ isSubmitting: false });
  const router = useRouter();
  const form = useForm<z.infer<typeof EditPengeluaranSchema>>({
    resolver: zodResolver(EditPengeluaranSchema),
    defaultValues: data,
  });

  async function onSubmit(values: z.infer<typeof EditPengeluaranSchema>) {
    // TODO: API / server action
    try {
      setLoadingStates((prev) => ({ ...prev, isSubmitting: true }));
      await EditPengeluaran(values);
      toast.success("Berhasil mengedit pengeluaran!");
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
          Isi form berikut untuk mengedit data pengeluaran.
        </FormDescription>
        {/* Nama Pengeluaran */}
        <FormField
          control={form.control}
          name="nama_pengeluaran"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Pengeluaran</FormLabel>
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
