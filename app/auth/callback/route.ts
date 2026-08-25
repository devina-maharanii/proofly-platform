/** Proofly Phase 11 callback handler: exchange a server-side auth code and redirect only to allowlisted in-app paths. */
import { NextResponse, type NextRequest } from "next/server";

import { safeAuthRedirect } from "@/lib/auth/redirects";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeAuthRedirect(request.nextUrl.searchParams.get("next"));
  const redirectUrl = request.nextUrl.clone();

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        redirectUrl.pathname = next;
        redirectUrl.search = "";
        if (next === "/verify-email") {
          redirectUrl.searchParams.set("status", "verified");
        }
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  redirectUrl.pathname = "/sign-in";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("error", "callback");
  return NextResponse.redirect(redirectUrl);
}
