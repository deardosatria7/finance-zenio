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
import { and, eq, gte, lt } from "drizzle-orm";
import { getRateLimiter } from "../rate-limiter";

export async function AddNewPemasukan(
  data: z.infer<typeof PemasukanFormSchema>,
) {
  const session = await getUserSessionSSR();

  try {
    await getRateLimiter().consume(`pemasukan_${session.user.id}`);
  } catch {
    throw new Error("Terlalu banyak request. Coba lagi nanti.");
  }

  await db.insert(pemasukan).values({
    userId: session.user.id,
    nominal: data.nominal.toFixed(2),
    namaPemasukan: data.nama_pemasukan,
    kategori: data.kategori,
  });
}

export async function EditPemasukan(data: z.infer<typeof EditPemasukanSchema>) {
  const session = await getUserSessionSSR();

  const [user_id] = await db
    .select({ user_id: pemasukan.userId })
    .from(pemasukan)
    .where(eq(pemasukan.id, data.id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  await db
    .update(pemasukan)
    .set({
      nominal: data.nominal.toFixed(2),
      namaPemasukan: data.nama_pemasukan,
      kategori: data.kategori,
    })
    .where(eq(pemasukan.id, data.id));
}

export async function DeletePemasukan(pemasukan_id: number) {
  const session = await getUserSessionSSR();

  const [user_id] = await db
    .select({ user_id: pemasukan.userId })
    .from(pemasukan)
    .where(eq(pemasukan.id, pemasukan_id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  await db.delete(pemasukan).where(eq(pemasukan.id, pemasukan_id));
}

export async function AddNewPengeluaran(
  data: z.infer<typeof PengeluaranFormSchema>,
) {
  const session = await getUserSessionSSR();

  try {
    await getRateLimiter().consume(`pengeluaran_${session.user.id}`);
  } catch {
    throw new Error("Terlalu banyak request. Coba lagi nanti.");
  }

  await db.insert(pengeluaran).values({
    userId: session.user.id,
    nominal: data.nominal.toFixed(2),
    namaPengeluaran: data.nama_pengeluaran,
    kategori: data.kategori,
  });
}

export async function EditPengeluaran(
  data: z.infer<typeof EditPengeluaranSchema>,
) {
  const session = await getUserSessionSSR();

  const [user_id] = await db
    .select({ user_id: pengeluaran.userId })
    .from(pengeluaran)
    .where(eq(pengeluaran.id, data.id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  await db
    .update(pengeluaran)
    .set({
      nominal: data.nominal.toFixed(2),
      namaPengeluaran: data.nama_pengeluaran,
      kategori: data.kategori,
    })
    .where(eq(pengeluaran.id, data.id));
}

export async function DeletePengeluaran(pengeluaran_id: number) {
  const session = await getUserSessionSSR();

  const [user_id] = await db
    .select({ user_id: pengeluaran.userId })
    .from(pengeluaran)
    .where(eq(pengeluaran.id, pengeluaran_id))
    .limit(1);

  if (session.user.id != user_id.user_id) {
    throw new Error("Not allowed!");
  }

  await db.delete(pengeluaran).where(eq(pengeluaran.id, pengeluaran_id));
}

export async function getExportData(type: "pemasukan" | "pengeluaran", month?: number, year?: number) {
  const session = await getUserSessionSSR();

  if (type === "pemasukan") {
    let whereClause = eq(pemasukan.userId, session.user.id);
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      whereClause = and(
        eq(pemasukan.userId, session.user.id),
        gte(pemasukan.createdAt, start),
        lt(pemasukan.createdAt, end),
      ) as typeof whereClause;
    }
    return db.select().from(pemasukan).where(whereClause).orderBy(pemasukan.createdAt);
  } else {
    let whereClause = eq(pengeluaran.userId, session.user.id);
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      whereClause = and(
        eq(pengeluaran.userId, session.user.id),
        gte(pengeluaran.createdAt, start),
        lt(pengeluaran.createdAt, end),
      ) as typeof whereClause;
    }
    return db.select().from(pengeluaran).where(whereClause).orderBy(pengeluaran.createdAt);
  }
}
