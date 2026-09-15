import BackButton from "@/components/back-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserSessionSSR } from "@/lib/session";
import { getLinkByUser } from "@/lib/telegram/link";
import { formatDate } from "@/lib/utils";
import { TelegramLinkActions } from "./components/telegram-link-actions";

const CONTOH_PESAN = [
  "makan siang nasi padang 25rb",
  "kemarin beli bensin 50rb",
  "gajian 8,5jt",
  "saldo aku berapa?",
];

export default async function TelegramPage() {
  const session = await getUserSessionSSR();
  const link = await getLinkByUser(session.user.id);

  return (
    <div className="mt-2 p-4 flex flex-col gap-4 max-w-2xl">
      <BackButton className="w-fit" />

      <Card>
        <CardHeader>
          <CardTitle>Bot Telegram</CardTitle>
          <CardDescription>
            Catat pemasukan dan pengeluaran, atau cek saldo, lewat chat
            Telegram.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            Status:{" "}
            {link ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Terhubung sejak {formatDate(link.createdAt)}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">
                Belum terhubung
              </span>
            )}
          </p>

          <TelegramLinkActions linked={link !== null} />

          <div className="text-sm text-muted-foreground">
            <p className="mb-1">Contoh pesan ke bot:</p>
            <ul className="list-disc pl-5">
              {CONTOH_PESAN.map((pesan) => (
                <li key={pesan}>
                  <code>{pesan}</code>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
