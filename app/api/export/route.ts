import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pemasukan, pengeluaran, wallet } from "@/db/schema";
import { getUserSessionSSR } from "@/lib/session";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDateRange } from "@/lib/utils";

/**
 * Satu sel teks CSV. Kutip ganda digandakan supaya kolom tidak bergeser, dan nilai berawalan
 * = + - @ diberi ' supaya Excel tidak menjalankannya sebagai formula (CSV injection).
 */
function selCsv(nilai: string) {
  const aman = /^[=+\-@\t\r]/.test(nilai) ? `'${nilai}` : nilai;
  return `"${aman.replace(/"/g, '""')}"`;
}

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
  // ?wallet=abc diabaikan, bukan dikirim ke DB sebagai NaN
  const walletParam = Number(searchParams.get("wallet"));
  const walletId =
    searchParams.get("wallet") && Number.isInteger(walletParam)
      ? walletParam
      : null;
  const { dateFrom, dateTo } = getDateRange(month, year);

  let rows: {
    nama: string;
    kategori: string;
    walletNama: string | null;
    nominal: string;
    tanggal: Date;
  }[] = [];

  if (type === "pemasukan") {
    const data = await db
      .select({ t: pemasukan, walletNama: wallet.nama })
      .from(pemasukan)
      .leftJoin(wallet, eq(wallet.id, pemasukan.walletId))
      .where(
        and(
          eq(pemasukan.userId, session.user.id),
          dateFrom ? gte(pemasukan.createdAt, dateFrom) : undefined,
          dateTo ? lt(pemasukan.createdAt, dateTo) : undefined,
          walletId !== null ? eq(pemasukan.walletId, walletId) : undefined,
        ),
      )
      .orderBy(pemasukan.createdAt);

    rows = data.map(({ t, walletNama }) => ({
      nama: t.namaPemasukan,
      kategori: t.kategori,
      walletNama,
      nominal: t.nominal,
      tanggal: t.createdAt,
    }));
  } else if (type === "pengeluaran") {
    const data = await db
      .select({ t: pengeluaran, walletNama: wallet.nama })
      .from(pengeluaran)
      .leftJoin(wallet, eq(wallet.id, pengeluaran.walletId))
      .where(
        and(
          eq(pengeluaran.userId, session.user.id),
          dateFrom ? gte(pengeluaran.createdAt, dateFrom) : undefined,
          dateTo ? lt(pengeluaran.createdAt, dateTo) : undefined,
          walletId !== null ? eq(pengeluaran.walletId, walletId) : undefined,
        ),
      )
      .orderBy(pengeluaran.createdAt);

    rows = data.map(({ t, walletNama }) => ({
      nama: t.namaPengeluaran,
      kategori: t.kategori,
      walletNama,
      nominal: t.nominal,
      tanggal: t.createdAt,
    }));
  } else {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const label = type === "pemasukan" ? "Nama Pemasukan" : "Nama Pengeluaran";
  const header = `${label},Kategori,Wallet,Nominal,Tanggal\n`;
  const csvBody = rows
    .map((r) => {
      const tanggal = new Date(r.tanggal).toLocaleDateString("id-ID");
      return `${selCsv(r.nama)},${selCsv(r.kategori)},${selCsv(r.walletNama ?? "-")},${r.nominal},${selCsv(tanggal)}`;
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
