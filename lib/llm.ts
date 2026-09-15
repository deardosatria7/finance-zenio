// Klien gateway LLM (OpenAI-compatible). Dipakai bot Telegram untuk menerjemahkan pesan
// jadi intent; LLM tidak pernah menyentuh DB, hasilnya selalu divalidasi ulang di intent.ts.

const DEFAULT_MODELS = [
  "openrouter/google/gemma-4-31b-it:free",
  "openrouter/nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  // Cadangan terakhir: paling stabil di tes 2026-09-15, tapi bisa sampai 10 detik
  "cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
];

const TIMEOUT_MS = 15_000;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getModels() {
  const fromEnv = process.env.AI_MODELS?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return fromEnv?.length ? fromEnv : DEFAULT_MODELS;
}

/** Isi balasan model, atau null kalau bentuknya bukan jawaban yang bisa dipakai */
function extractContent(body: string): string | null {
  // Gateway kadang menambahkan sufiks "data: [DONE]" di belakang JSON, bahkan untuk error
  const json = body.replace(/\s*data:\s*\[DONE\]\s*$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const content = (parsed as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;

  return typeof content === "string" && content.trim() ? content : null;
}

async function callModel(model: string, messages: ChatMessage[]) {
  const gateway = process.env.AI_ZENIO_GATEWAY;
  const apiKey = process.env.AI_ZENIO_API_KEY;
  if (!gateway || !apiKey) {
    throw new Error("AI_ZENIO_GATEWAY dan AI_ZENIO_API_KEY wajib diisi");
  }

  const response = await fetch(`${gateway}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // Error bisa datang dengan HTTP 200, jadi status bukan satu-satunya penentu:
  // yang menentukan adalah ada tidaknya choices[0].message.content.
  return extractContent(await response.text());
}

/**
 * Coba tiap model berurutan sampai ada yang membalas isi; null kalau semuanya gagal
 * (rate limit upstream, overload, timeout, atau balasan tanpa content).
 */
export async function chatCompletion(
  messages: ChatMessage[],
): Promise<string | null> {
  for (const model of getModels()) {
    try {
      const content = await callModel(model, messages);
      if (content) return content;
      console.warn(`LLM ${model}: balasan tanpa content`);
    } catch (error) {
      console.warn(
        `LLM ${model} gagal:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return null;
}
