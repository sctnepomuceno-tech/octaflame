"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/**
 * Destination for Supabase invite/recovery email links. The token arrives
 * in the URL hash, which never reaches the server — the browser client
 * (detectSessionInUrl) exchanges it for a session and persists it to
 * cookies, then we hard-navigate so middleware re-evaluates with those
 * cookies present (§5.6).
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().finally(() => {
      window.location.replace("/");
    });
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
