"use client";

import { Pemasukan } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRupiah } from "@/lib/utils";
import { ButtonEditPemasukan } from "./edit-pemasukan";
import { ButtonDeletePemasukan } from "./delete-pemasukan-button";

interface PemasukanTableProps {
  data: Pemasukan[];
}

export default function PemasukanTable({ data }: PemasukanTableProps) {
  return (
    <div className="rounded-lg border bg-white text-neutral-900border-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-neutral-200 dark:border-neutral-800">
            <TableHead className="text-neutral-600 dark:text-neutral-400">
              Nama Pemasukan
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
                Belum ada data pemasukan
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={item.id}
                className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
              >
                <TableCell className="font-medium">
                  {item.namaPemasukan}
                </TableCell>

                <TableCell className="text-neutral-500 dark:text-neutral-400">
                  {formatDate(item.createdAt)}
                </TableCell>

                <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(item.nominal)}
                </TableCell>
                <TableCell className="font-semibold flex items-center justify-end gap-2">
                  <ButtonEditPemasukan
                    data={{
                      id: item.id,
                      nama_pemasukan: item.namaPemasukan,
                      nominal: Number(item.nominal),
                    }}
                  />
                  <ButtonDeletePemasukan pemasukan_id={item.id} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
