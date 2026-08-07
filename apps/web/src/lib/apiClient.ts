import { supabase } from "./supabaseClient";

// Falls back to "" (relative URL) rather than "http://localhost:8080" so
// requests go through Next.js's own /api/* rewrite proxy (next.config.js)
// instead of hitting the browser's own "localhost" directly. On a phone
// accessing the dev server over LAN, "http://localhost:8080" resolves to
// the phone itself (nothing listening there) and every call fails with
// "Failed to fetch" — the relative path hits the Next dev server the
// phone is already talking to, which then proxies to 8080 server-side
// (same machine, so "localhost" is correct there). Desktop is unaffected
// since the page's own origin already is localhost in that case.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Your session has expired. Please log in again.");
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}
