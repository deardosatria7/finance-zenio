import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pemasukan, pengeluaran } from "@/db/schema";
import { getUserSessionSSR } from "@/lib/actions/sessions";
import { and, eq, gte, lt } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getUserSessionSSR();
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type") as "pemasukan" | "pengeluaran";
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : null;
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : null;
  const now = new Date();

  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;
  if (month && year) {
    dateFrom = new Date(year, month - 1, 1);
    dateTo = new Date(year, month, 1);
  } else if (year) {
    dateFrom = new Date(year, 0, 1);
    dateTo = new Date(year + 1, 0, 1);
  } else if (month) {
    dateFrom = new Date(now.getFullYear(), month - 1, 1);
    dateTo = new Date(now.getFullYear(), month, 1);
  }

  let rows: { nama: string; kategori: string; nominal: string; tanggal: Date }[] = [];

  if (type === "pemasukan") {
    const data = await db
      .select()
      .from(pemasukan)
      .where(
        and(
          eq(pemasukan.userId, session.user.id),
          dateFrom ? gte(pemasukan.createdAt, dateFrom) : undefined,
          dateTo ? lt(pemasukan.createdAt, dateTo) : undefined,
        )
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
        )
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
