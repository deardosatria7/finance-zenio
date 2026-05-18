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
import MonthFilter from "@/components/month-filter";
import ExportButton from "@/components/export-button";

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

  const filterMonth = typeof params.month === "string" ? Number(params.month) : null;
  const filterYear = typeof params.year === "string" ? Number(params.year) : null;

  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;
  if (filterMonth && filterYear) {
    dateFrom = new Date(filterYear, filterMonth - 1, 1);
    dateTo = new Date(filterYear, filterMonth, 1);
  } else if (filterYear) {
    dateFrom = new Date(filterYear, 0, 1);
    dateTo = new Date(filterYear + 1, 0, 1);
  } else if (filterMonth) {
    dateFrom = new Date(now.getFullYear(), filterMonth - 1, 1);
    dateTo = new Date(now.getFullYear(), filterMonth, 1);
  }

  const baseWhere = and(
    eq(pengeluaran.userId, session.user.id),
    searchQuery ? ilike(pengeluaran.namaPengeluaran, `%${searchQuery}%`) : undefined,
    dateFrom ? gte(pengeluaran.createdAt, dateFrom) : undefined,
    dateTo ? lt(pengeluaran.createdAt, dateTo) : undefined,
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

  const filteredTotal = dateFrom
    ? await db
        .select({ total: sql<string>`COALESCE(SUM(${pengeluaran.nominal}), 0)` })
        .from(pengeluaran)
        .where(baseWhere)
        .then((r) => r[0].total)
    : null;

  return (
    <>
      <div className="mt-2 p-4 flex flex-col gap-4 mx-auto">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <SearchBar />
          <MonthFilter />
        </div>
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
          {filteredTotal !== null && dateFrom && (
            <div className="px-5 py-3 border rounded-xl shadow-lg sm:col-span-2 border-rose-200 dark:border-rose-900">
              <span className="text-sm text-neutral-400">
                Total hasil filter:
              </span>{" "}
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {formatRupiah(filteredTotal)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <BackButton className="w-fit" />
          <ButtonAddNewPengeluaran />
          <ExportButton type="pengeluaran" month={filterMonth ?? undefined} year={filterYear ?? undefined} />
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
