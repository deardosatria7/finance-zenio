"use server";

import { z } from "zod";
import {
  EditPemasukanSchema,
  EditPengeluaranSchema,
  PemasukanFormSchema,
  PengeluaranFormSchema,
} from "../types";
import { getUserSessionSSR } from "../session";
import {
  addPemasukan,
  addPengeluaran,
  deletePemasukan,
  deletePengeluaran,
  editPemasukan,
  editPengeluaran,
} from "../finances";

// Server action adalah endpoint publik: input divalidasi ulang di sini, bukan hanya di form.
// parse() juga membuang field di luar schema, jadi client tidak bisa menyelipkan `tanggal`.

const IdSchema = z.number().int();

export async function AddNewPemasukan(
  data: z.infer<typeof PemasukanFormSchema>,
) {
  const session = await getUserSessionSSR();
  await addPemasukan(session.user.id, PemasukanFormSchema.parse(data));
}

export async function EditPemasukan(data: z.infer<typeof EditPemasukanSchema>) {
  const session = await getUserSessionSSR();
  await editPemasukan(session.user.id, EditPemasukanSchema.parse(data));
}

export async function DeletePemasukan(pemasukan_id: number) {
  const session = await getUserSessionSSR();
  await deletePemasukan(session.user.id, IdSchema.parse(pemasukan_id));
}

export async function AddNewPengeluaran(
  data: z.infer<typeof PengeluaranFormSchema>,
) {
  const session = await getUserSessionSSR();
  await addPengeluaran(session.user.id, PengeluaranFormSchema.parse(data));
}

export async function EditPengeluaran(
  data: z.infer<typeof EditPengeluaranSchema>,
) {
  const session = await getUserSessionSSR();
  await editPengeluaran(session.user.id, EditPengeluaranSchema.parse(data));
}

export async function DeletePengeluaran(pengeluaran_id: number) {
  const session = await getUserSessionSSR();
  await deletePengeluaran(session.user.id, IdSchema.parse(pengeluaran_id));
}
