"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * Destination for Supabase invite/recovery email links. The browser client
 * is configured for the PKCE flow (@supabase/ssr's createBrowserClient
 * default), so the email link arrives as ?code=... rather than a URL hash
 * — it has to be explicitly exchanged for a session before it's persisted
 * to cookies. Once that's done we hard-navigate so middleware re-evaluates
 * with those cookies present (§5.6).
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createClient();
    const code = new URL(window.location.href).searchParams.get("code");
    const settled = code
      ? supabase.auth.exchangeCodeForSession(code)
      : supabase.auth.getSession();
    settled.finally(() => {
      window.location.replace("/");
    });
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
