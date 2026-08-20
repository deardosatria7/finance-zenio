import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

// Nilai yang dipakai Dockerfile hanya supaya `next build` tidak jatuh ke secret
// default better-auth. Kalau nilai ini sampai terpakai saat melayani request,
// berarti environment runtime belum diisi.
const BUILD_PLACEHOLDER = "build-only-placeholder-do-not-use-at-runtime";

// better-auth tidak berhenti saat secret kosong — ia diam-diam memakai secret
// default yang diketahui publik. Jadi kegagalannya kita buat nyaring di sini.
function assertSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret === BUILD_PLACEHOLDER) {
    throw new Error(
      "BETTER_AUTH_SECRET belum diset di environment runtime. Isi variabel " +
        "tersebut dengan nilai yang sama persis di pintarpy dan finance-zenio, " +
        "karena keduanya memakai tabel sesi yang sama."
    );
  }
}

export async function GET(request: Request) {
  assertSecret();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  assertSecret();
  return handlers.POST(request);
}
