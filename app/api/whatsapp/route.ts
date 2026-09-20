import { tanganiPesan } from "@/lib/whatsapp/bot";
import { kirimPesan } from "@/lib/whatsapp/client";
import { pesanBaru } from "@/lib/whatsapp/state";
import { bacaPesan, verifikasiTandaTangan } from "@/lib/whatsapp/webhook";
import { after } from "next/server";

// pg dan ioredis butuh runtime Node.js, bukan Edge
export const runtime = "nodejs";

export async function POST(request: Request) {
  // HMAC dihitung dari byte asli, jadi body dibaca sebagai teks — bukan request.json()
  const raw = await request.text();

  if (!verifikasiTandaTangan(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Tanda tangan tidak cocok", { status: 401 });
  }

  const pesan = bacaPesan(raw);
  if (!pesan) {
    return new Response(null, { status: 204 });
  }

  if (!(await pesanBaru(pesan.id))) {
    return new Response(null, { status: 204 });
  }

  // Parsing LLM bisa belasan detik. Balas 200 lebih dulu supaya GOWA tidak menganggap webhook
  // gagal dan mengirim ulang pesan yang sama.
  after(async () => {
    try {
      await tanganiPesan(pesan);
    } catch (error) {
      // Isi pesan tidak ikut di-log
      console.error(
        `Bot WhatsApp error (pesan ${pesan.id}, chat ${pesan.balasKe}):`,
        error,
      );
      await kirimPesan(pesan.balasKe, "Maaf, terjadi kesalahan. Coba lagi nanti.");
    }
  });

  return new Response(null, { status: 204 });
}
