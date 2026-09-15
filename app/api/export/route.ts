import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pemasukan, pengeluaran } from "@/db/schema";
import { getUserSessionSSR } from "@/lib/session";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDateRange } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getUserSessionSSR();
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type") as "pemasukan" | "pengeluaran";
  const month = searchParams.get("month")
    ? Number(searchParams.get("month"))
    : null;
  const year = searchParams.get("year")
    ? Number(searchParams.get("year"))
    : null;

  const { dateFrom, dateTo } = getDateRange(month, year);

  let rows: {
    nama: string;
    kategori: string;
    nominal: string;
    tanggal: Date;
  }[] = [];

  if (type === "pemasukan") {
    const data = await db
      .select()
      .from(pemasukan)
      .where(
        and(
          eq(pemasukan.userId, session.user.id),
          dateFrom ? gte(pemasukan.createdAt, dateFrom) : undefined,
          dateTo ? lt(pemasukan.createdAt, dateTo) : undefined,
        ),
      )
      .orderBy(pemasukan.createdAt);

    rows = data.map((d) => ({
      nama: d.namaPemasukan,
      kategori: d.kategori,
      nominal: d.nominal,
      tanggal: d.createdAt,
    }));
  } else if (type === "pengeluaran") {
    const data = await db
      .select()
      .from(pengeluaran)
      .where(
        and(
          eq(pengeluaran.userId, session.user.id),
          dateFrom ? gte(pengeluaran.createdAt, dateFrom) : undefined,
          dateTo ? lt(pengeluaran.createdAt, dateTo) : undefined,
        ),
      )
      .orderBy(pengeluaran.createdAt);

    rows = data.map((d) => ({
      nama: d.namaPengeluaran,
      kategori: d.kategori,
      nominal: d.nominal,
      tanggal: d.createdAt,
    }));
  } else {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const label = type === "pemasukan" ? "Nama Pemasukan" : "Nama Pengeluaran";
  const header = `${label},Kategori,Nominal,Tanggal\n`;
  const csvBody = rows
    .map((r) => {
      const tanggal = new Date(r.tanggal).toLocaleDateString("id-ID");
      return `"${r.nama}","${r.kategori}",${r.nominal},"${tanggal}"`;
    })
    .join("\n");

  const csv = header + csvBody;
  const filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
