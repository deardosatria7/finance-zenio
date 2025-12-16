import SearchBar from "@/components/search-bar";
import { db } from "@/db";
import { pengeluaran } from "@/db/schema";
import { getUserSessionSSR } from "@/lib/actions/sessions";
import { and, eq, ilike, gte, lt, sql } from "drizzle-orm";
import BackButton from "@/components/back-button";
import { formatRupiah } from "@/lib/utils";
import Pagination from "@/components/pagination";
import PengeluaranTable from "./components/pengeluaran-table";
import { ButtonAddNewPengeluaran } from "./components/add-new-pengeluaran";

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getUserSessionSSR();
  const params = await searchParams;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const searchQuery =
    typeof params.search === "string" ? params.search.trim() : "";

  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 10);
  const offset = (page - 1) * limit;

  const baseWhere = and(
    eq(pengeluaran.userId, session.user.id),
    searchQuery
      ? ilike(pengeluaran.namaPengeluaran, `%${searchQuery}%`)
      : undefined
  );

  const [dataPengeluaran, countResult, allTimeResult, monthResult] =
    await Promise.all([
      db.query.pengeluaran.findMany({
        where: baseWhere,
        orderBy: (p, { desc }) => desc(p.createdAt),
        limit,
        offset,
      }),

      db
        .select({ count: sql<number>`count(*)` })
        .from(pengeluaran)
        .where(baseWhere),

      db
        .select({
          total: sql<string>`COALESCE(SUM(${pengeluaran.nominal}), 0)`,
        })
        .from(pengeluaran)
        .where(eq(pengeluaran.userId, session.user.id)),

      db
        .select({
          total: sql<string>`COALESCE(SUM(${pengeluaran.nominal}), 0)`,
        })
        .from(pengeluaran)
        .where(
          and(
            eq(pengeluaran.userId, session.user.id),
            gte(pengeluaran.createdAt, startOfMonth),
            lt(pengeluaran.createdAt, startOfNextMonth)
          )
        ),
    ]);

  const totalItems = Number(countResult[0].count);
  const totalPages = Math.ceil(totalItems / limit);

  return (
    <>
      <div className="mt-2 p-4 flex flex-col gap-4 mx-auto">
        <SearchBar />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="px-5 py-3 border rounded-xl shadow-lg">
            <span className="text-sm text-neutral-400">
              Total pengeluaran all time:
            </span>{" "}
            {formatRupiah(allTimeResult[0].total)}
          </div>
          <div className="px-5 py-3 border rounded-xl shadow-lg">
            <span className="text-sm text-neutral-400">
              Total pengeluaran bulan ini:
            </span>{" "}
            {formatRupiah(monthResult[0].total)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BackButton className="w-fit" />
          <ButtonAddNewPengeluaran />
        </div>
        <div>
          <PengeluaranTable data={dataPengeluaran} />
        </div>
        <div>
          {dataPengeluaran.length > 0 && (
            <Pagination currentPage={page} totalPages={totalPages} />
          )}
        </div>
      </div>
    </>
  );
}
