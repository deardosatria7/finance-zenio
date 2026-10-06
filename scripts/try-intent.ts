// Tes parser intent tanpa lewat Telegram (buat ngecek perubahan system prompt):
//   npx tsx scripts/try-intent.ts
import "dotenv/config";
import { parseIntent } from "../lib/whatsapp/intent";

const PESAN = [
  "makan siang 25rb",
  "bensin 50rb kemarin",
  "gajian 8,5jt",
  "kopi 20rb pakai gopay",
  "saldo bca berapa",
  "yang kopi tadi pindahin ke ovo",
  "yang bensin tadi ternyata 60rb",
  "hapus parkir kemarin",
  "sisa duitku berapa",
  "pengeluaran minggu ini",
  "halo apa kabar",
];

// Contoh daftar wallet user; "ovo" sengaja tidak ada untuk mengecek nama yang tidak dikenal
const WALLET = ["Utama", "GoPay", "BCA"];

async function main() {
  for (const pesan of PESAN) {
    const mulai = Date.now();
    try {
      const intent = await parseIntent(pesan, WALLET);
      console.log(`${pesan} (${Date.now() - mulai}ms) ->`, JSON.stringify(intent));
    } catch (error) {
      console.log(`${pesan} (${Date.now() - mulai}ms) -> GAGAL`, error);
    }
  }
}

main();
