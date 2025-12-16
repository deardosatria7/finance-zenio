"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EditPemasukanSchema } from "@/lib/types";

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
import { AddNewPemasukan, EditPemasukan } from "@/lib/actions/finances";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

type EditPemasukanFormProps = {
  data: z.infer<typeof EditPemasukanSchema>;
  onSuccess?: () => void;
};

export function ButtonEditPemasukan({
  data,
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

          <EditPemasukanForm data={data} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditPemasukanForm({ data, onSuccess }: EditPemasukanFormProps) {
  const [loadingStates, setLoadingStates] = useState({ isSubmitting: false });
  const router = useRouter();
  const form = useForm<z.infer<typeof EditPemasukanSchema>>({
    resolver: zodResolver(EditPemasukanSchema),
    defaultValues: data,
  });

  async function onSubmit(values: z.infer<typeof EditPemasukanSchema>) {
    // TODO: API / server action
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
