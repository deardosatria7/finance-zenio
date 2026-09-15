// lib/session.ts

import { cookies } from "next/headers";
import { auth } from "./auth";
import { redirect } from "next/navigation";

// =======================
// CORE SESSION FUNCTION
// =======================
export async function getSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({ headers });
}

// =======================
// GET SESSION FOR SSR PAGES
// =======================
export async function getUserSessionSSR() {
  const cookieStore = await cookies();

  const session = await getSessionFromHeaders(
    new Headers({
      cookie: cookieStore.toString(),
    }),
  );

  if (!session) {
    redirect("/auth");
  }

  return session;
}
