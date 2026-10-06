import BackButton from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserSessionSSR } from "@/lib/session";
import { formatRupiah } from "@/lib/utils";
import { getTransfers } from "@/lib/transfers";
import { getSaldoPerWallet } from "@/lib/wallets";
import { TransferFormDialog } from "./components/transfer-form-dialog";
import { TransferList } from "./components/transfer-list";
import { WalletActions } from "./components/wallet-actions";
import { WalletFormDialog } from "./components/wallet-form-dialog";

type SaldoWallet = Awaited<ReturnType<typeof getSaldoPerWallet>>[number];

export default async function WalletPage() {
  const session = await getUserSessionSSR();
  const [wallets, transfers] = await Promise.all([
    getSaldoPerWallet(session.user.id),
    getTransfers(session.user.id),
  ]);

  const aktif = wallets.filter((w) => w.archivedAt === null);
  const arsip = wallets.filter((w) => w.archivedAt !== null);
  const total = wallets.reduce((jumlah, w) => jumlah + w.saldo, 0);

  return (
    <div className="mt-2 p-4 flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <BackButton className="w-fit" />
        <WalletFormDialog />
        <TransferFormDialog
          wallets={aktif.map(({ id, nama, isDefault }) => ({
            id,
            nama,
            isDefault,
          }))}
        />
      </div>

      <div className="px-5 py-3 border rounded-xl shadow-lg">
        <span className="text-sm text-neutral-400">
          Total saldo semua wallet:
        </span>{" "}
        {formatRupiah(total)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {aktif.map((w) => (
          <KartuWallet key={w.id} wallet={w} />
        ))}
      </div>

      {arsip.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-muted-foreground">
            Diarsipkan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-70">
            {arsip.map((w) => (
              <KartuWallet key={w.id} wallet={w} />
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-medium text-muted-foreground">
        Transfer terakhir
      </h2>
      <TransferList transfers={transfers} />
    </div>
  );
}

function KartuWallet({ wallet }: { wallet: SaldoWallet }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {wallet.nama}
          {wallet.isDefault && <Badge>Default</Badge>}
        </CardTitle>
        <CardDescription>
          Saldo awal {formatRupiah(wallet.saldoAwal)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`text-xl font-semibold ${wallet.saldo < 0 ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {formatRupiah(wallet.saldo)}
        </span>
        <WalletActions
          wallet={{
            id: wallet.id,
            nama: wallet.nama,
            saldoAwal: wallet.saldoAwal,
            isDefault: wallet.isDefault,
            archived: wallet.archivedAt !== null,
          }}
        />
      </CardContent>
    </Card>
  );
}
