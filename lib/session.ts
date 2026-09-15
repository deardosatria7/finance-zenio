// lib/session.ts

import { cookies } from "next/headers";
import { auth } from "../auth";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

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
    })
  );

  if (!session) {
    redirect("/auth");
  }

  return session;
}

// =======================
// GET SESSION FOR API ROUTE (route.ts)
// =======================
export async function getUserSessionAPI(req: NextRequest) {
  const session = await getSessionFromHeaders(req.headers);

  if (!session) {
    return null;
  }

  return session;
}
