import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "pg" or "mysql"
    schema: {
      user,
      verification,
      session,
      account,
    },
  }),
  // Daftar lewat email ditutup: email tidak diverifikasi, jadi siapa pun bisa mendaftar dengan
  // email orang lain lalu ikut masuk setelah pemiliknya login Google (auto-link). Login tetap
  // bisa. Harus sama dengan pintarpy, karena endpoint sign-up di sana juga menulis ke tabel ini.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!, // Will set this up later
      clientSecret: process.env.AUTH_GOOGLE_SECRET!, // Will set this up later
    },
  },
});
