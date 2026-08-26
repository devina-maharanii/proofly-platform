/**
 * Proofly Phase 11 auth boundary: refresh Supabase cookie sessions and guard
 * the neutral authenticated and password-recovery routes with verified claims.
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";

const protectedPaths = new Set([
  "/auth/continue",
  "/onboarding",
  "/profile",
  "/reset-password",
  "/settings",
  "/applications",
  "/reviewer/application",
  "/reviewer/opportunities",
  "/admin/reviewers",
]);

const isProtectedPath = (pathname: string) =>
  protectedPaths.has(pathname) ||
  pathname.startsWith("/profile/") ||
  pathname.startsWith("/applications/") ||
  pathname.startsWith("/reviewer/") ||
  pathname.startsWith("/admin/reviewers") ||
  pathname.startsWith("/company/applications/") ||
  pathname.startsWith("/workspaces/") ||
  /^\/projects\/prj_[a-f0-9]{20,40}\/apply$/.test(pathname);

export async function proxy(request: NextRequest) {
  const config = getPublicSupabaseConfig();
  if (!config) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = "/sign-in";
      signInUrl.search = "";
      signInUrl.searchParams.set("next", request.nextUrl.pathname);
      signInUrl.searchParams.set("error", "session-expired");
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (isProtectedPath(request.nextUrl.pathname) && !data?.claims?.sub) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    signInUrl.searchParams.set("error", "session-expired");
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/auth/continue",
    "/onboarding",
    "/profile",
    "/profile/:path*",
    "/reset-password",
    "/settings",
    "/applications",
    "/applications/:path*",
    "/reviewer/:path*",
    "/admin/reviewers/:path*",
    "/company/applications/:path*",
    "/workspaces/:path*",
    "/projects/:path*/apply",
  ],
};
