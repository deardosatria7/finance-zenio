"use client";

import { Pengeluaran } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRupiah } from "@/lib/utils";
import { ButtonEditPengeluaran } from "./edit-pengeluaran";
import { ButtonDeletePengeluaran } from "./delete-pengeluaran-button";

interface PengeluaranTableProps {
  data: Pengeluaran[];
}

export default function PengeluaranTable({ data }: PengeluaranTableProps) {
  return (
    <div className="rounded-lg border bg-white text-neutral-900border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-neutral-200 dark:border-neutral-800">
            <TableHead className="text-neutral-600 dark:text-neutral-400">
              Nama Pengeluaran
            </TableHead>
            <TableHead className="text-neutral-600 dark:text-neutral-400">
              Tanggal
            </TableHead>
            <TableHead className="text-right text-neutral-600 dark:text-neutral-400">
              Nominal
            </TableHead>
            <TableHead className="text-right text-neutral-600 dark:text-neutral-400">
              Aksi
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-neutral-500 dark:text-neutral-400"
              >
                Belum ada data pengeluaran
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={item.id}
                className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
              >
                <TableCell className="font-medium">
                  {item.namaPengeluaran}
                </TableCell>

                <TableCell className="text-neutral-500 dark:text-neutral-400">
                  {formatDate(item.createdAt)}
                </TableCell>

                <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                  {formatRupiah(item.nominal)}
                </TableCell>
                <TableCell className="font-semibold flex items-center justify-end gap-2">
                  <ButtonEditPengeluaran
                    data={{
                      id: item.id,
                      nama_pengeluaran: item.namaPengeluaran,
                      nominal: Number(item.nominal),
                    }}
                  />
                  <ButtonDeletePengeluaran pengeluaran_id={item.id} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
