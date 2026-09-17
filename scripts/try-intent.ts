// Tes parser intent tanpa lewat Telegram (buat ngecek perubahan system prompt):
//   npx tsx scripts/try-intent.ts
import "dotenv/config";
import { parseIntent } from "../lib/telegram/intent";

const PESAN = [
  "makan siang 25rb",
  "bensin 50rb kemarin",
  "gajian 8,5jt",
  "yang bensin tadi ternyata 60rb",
  "hapus parkir kemarin",
  "sisa duitku berapa",
  "pengeluaran minggu ini",
  "halo apa kabar",
];

async function main() {
  for (const pesan of PESAN) {
    const mulai = Date.now();
    try {
      const intent = await parseIntent(pesan);
      console.log(`${pesan} (${Date.now() - mulai}ms) ->`, JSON.stringify(intent));
    } catch (error) {
      console.log(`${pesan} (${Date.now() - mulai}ms) -> GAGAL`, error);
    }
  }
}

main();
