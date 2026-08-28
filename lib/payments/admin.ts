/** Phase 34 privileged boundary: only verified provider webhook and adapter follow-up calls may use the service role. */
import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function createPaymentAdminSupabaseClient() {
  const publicConfig = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicConfig || !serviceRoleKey) return null;
  return createClient(publicConfig.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
