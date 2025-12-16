"use server";

import {
  EditPemasukanSchema,
  EditPengeluaranSchema,
  PemasukanFormSchema,
  PengeluaranFormSchema,
} from "../types";
import { z } from "zod";
import { getUserSessionSSR } from "./sessions";
import { db } from "@/db";
import { pemasukan, pengeluaran } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimiter } from "../rate-limiter";

export async function AddNewPemasukan(
  data: z.infer<typeof PemasukanFormSchema>
) {
  const session = await getUserSessionSSR();

  // rate limit per user
  const { success } = await rateLimiter.limit(`pemasukan_${session.user.id}`);
  if (!success) {
    throw new Error("Terlalu banyak request. Coba lagi nanti.");
  }

  // add new row to pemasukan
  await db.insert(pemasukan).values({
    userId: session.user.id,
    nominal: data.nominal.toFixed(2),
    namaPemasukan: data.nama_pemasukan,
  });
}

export async function EditPemasukan(data: z.infer<typeof EditPemasukanSchema>) {
  const session = await getUserSessionSSR();

  // check id user untuk pemasukan id yang sama
  const [user_id] = await db
    .select({ user_id: pemasukan.userId })
    .from(pemasukan)
    .where(eq(pemasukan.id, data.id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  // edit pemasukan
  await db
    .update(pemasukan)
    .set({
      nominal: data.nominal.toFixed(2),
      namaPemasukan: data.nama_pemasukan,
    })
    .where(eq(pemasukan.id, data.id));
}

export async function DeletePemasukan(pemasukan_id: number) {
  const session = await getUserSessionSSR();

  // check id user untuk pemasukan id yang sama
  const [user_id] = await db
    .select({ user_id: pemasukan.userId })
    .from(pemasukan)
    .where(eq(pemasukan.id, pemasukan_id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  // delete pemasukan
  await db.delete(pemasukan).where(eq(pemasukan.id, pemasukan_id));
}

export async function AddNewPengeluaran(
  data: z.infer<typeof PengeluaranFormSchema>
) {
  const session = await getUserSessionSSR();

  // rate limit per user
  const { success } = await rateLimiter.limit(`pengeluaran_${session.user.id}`);
  if (!success) {
    throw new Error("Terlalu banyak request. Coba lagi nanti.");
  }

  // add new row to pengeluaran
  await db.insert(pengeluaran).values({
    userId: session.user.id,
    nominal: data.nominal.toFixed(2),
    namaPengeluaran: data.nama_pengeluaran,
  });
}

export async function EditPengeluaran(
  data: z.infer<typeof EditPengeluaranSchema>
) {
  const session = await getUserSessionSSR();

  // check id user untuk pengeluaran id yang sama
  const [user_id] = await db
    .select({ user_id: pengeluaran.userId })
    .from(pengeluaran)
    .where(eq(pengeluaran.id, data.id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  // edit pengeluaran
  await db
    .update(pengeluaran)
    .set({
      nominal: data.nominal.toFixed(2),
      namaPengeluaran: data.nama_pengeluaran,
    })
    .where(eq(pengeluaran.id, data.id));
}

export async function DeletePengeluaran(pengeluaran_id: number) {
  const session = await getUserSessionSSR();

  // check id user untuk pengeluaran id yang sama
  const [user_id] = await db
    .select({ user_id: pengeluaran.userId })
    .from(pengeluaran)
    .where(eq(pengeluaran.id, pengeluaran_id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  // delete pemasukan
  await db.delete(pengeluaran).where(eq(pengeluaran.id, pengeluaran_id));
}
