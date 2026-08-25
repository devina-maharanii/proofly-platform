import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }

  if (originalKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

describe("Phase 11 Supabase server/client security boundary", () => {
  it("requires a valid HTTPS public configuration and never treats a service credential as browser configuration", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(getPublicSupabaseConfig()).toBeNull();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://insecure.example";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    expect(getPublicSupabaseConfig()).toBeNull();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    expect(getPublicSupabaseConfig()).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("keeps the browser client restricted to the approved public configuration and keeps sensitive auth handlers free of logs", () => {
    const browserSource = readFileSync(
      join(repositoryRoot, "lib/supabase/browser.ts"),
      "utf8"
    );
    const actionSource = readFileSync(
      join(repositoryRoot, "lib/auth/actions.ts"),
      "utf8"
    );

    expect(browserSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(browserSource).not.toContain("service_role");
    expect(actionSource).not.toMatch(
      /console\.(log|info|warn|error|debug)\s*\(/
    );
    expect(actionSource).not.toMatch(/return\s+.*password/i);
    expect(actionSource).not.toMatch(/return\s+.*token/i);
  });
});
