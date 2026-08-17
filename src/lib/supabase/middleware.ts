import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/login", "/auth"];
const CHANGE_PASSWORD_PATH = "/change-password";

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Refreshes the Supabase session on every request and enforces the three
 * access gates that must never depend on the client remembering to check
 * them (§4.1 #1, §5.5, §5.9):
 *   1. no session            -> /login
 *   2. profile.active=false  -> signed out, /login (deactivation is immediate)
 *   3. must_change_password  -> /change-password (forced first-login gate)
 *
 * This is the first line of defense, not the only one — every server
 * action and RLS policy enforces the same rules independently (§15).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublicPath(pathname)) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "message",
      "Your account is no longer active. Contact Management for access."
    );
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = profile.must_change_password ? CHANGE_PASSWORD_PATH : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (profile.must_change_password && pathname !== CHANGE_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!profile.must_change_password && pathname === CHANGE_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
