import LogoutButton from "@/components/logout-button";
import { db } from "@/db";
import { pemasukan, pengeluaran } from "@/db/schema";
import { getUserSessionSSR } from "@/lib/actions/sessions";
import type { Pemasukan, Pengeluaran } from "@/lib/types";
import { eq } from "drizzle-orm";
import { ButtonAddNewPemasukan } from "./pemasukan/components/add-new-pemasukan";
import { ButtonAddNewPengeluaran } from "./pengeluaran/components/add-new-pengeluaran";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getUserSessionSSR();
  let pengeluaranAll: Pengeluaran[] = [];
  let pemasukanAll: Pemasukan[] = [];

  // fetch all data pengeluaran and pemasukan for this user
  pengeluaranAll = await db
    .select()
    .from(pengeluaran)
    .where(eq(pengeluaran.userId, session.user.id));

  pemasukanAll = await db
    .select()
    .from(pemasukan)
    .where(eq(pemasukan.userId, session.user.id));

  // Calculate totals
  const totalPemasukan = pemasukanAll.reduce(
    (sum, item) => sum + Number.parseFloat(item.nominal),
    0
  );
  const totalPengeluaran = pengeluaranAll.reduce(
    (sum, item) => sum + Number.parseFloat(item.nominal),
    0
  );
  const saldo = totalPemasukan - totalPengeluaran;

  // Get recent transactions (5 most recent from each)
  const recentPemasukan = [...pemasukanAll]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);
  const recentPengeluaran = [...pengeluaranAll]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">
              Dashboard Keuangan
            </h1>
            <p className="text-muted-foreground mt-1">
              Selamat datang kembali, {session.user.name}!
            </p>
          </div>
          <LogoutButton />
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {/* Pemasukan Card */}
          <Link href="/dashboard/pemasukan" className="block">
            <Card className="border-emerald-200 dark:border-emerald-900 cursor-pointer hover:shadow-md transition hover:scale-105">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Pemasukan
                </CardTitle>
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalPemasukan)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pemasukanAll.length} transaksi
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Pengeluaran Card */}
          <Link href="/dashboard/pengeluaran" className="block">
            <Card className="border-rose-200 dark:border-rose-900 cursor-pointer hover:shadow-md transition hover:scale-105">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Pengeluaran
                </CardTitle>
                <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center">
                  <ArrowDownRight className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalPengeluaran)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pengeluaranAll.length} transaksi
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Saldo Card */}
          <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  saldo >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatCurrency(saldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo saat ini
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Pemasukan */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Pemasukan Terbaru
              </CardTitle>
              <ButtonAddNewPemasukan small_ver={true} />
            </CardHeader>
            <CardContent>
              {recentPemasukan.length > 0 ? (
                <div className="space-y-3">
                  {recentPemasukan.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.namaPemasukan}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(Number.parseFloat(item.nominal))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowUpRight className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada data pemasukan</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Pengeluaran */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Pengeluaran Terbaru
              </CardTitle>
              <ButtonAddNewPengeluaran small_ver={true} />
            </CardHeader>
            <CardContent>
              {recentPengeluaran.length > 0 ? (
                <div className="space-y-3">
                  {recentPengeluaran.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.namaPengeluaran}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-rose-600 dark:text-rose-400">
                          -{formatCurrency(Number.parseFloat(item.nominal))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowDownRight className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Belum ada data pengeluaran</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
