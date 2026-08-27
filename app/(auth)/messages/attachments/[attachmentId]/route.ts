/** Phase 31 private attachment boundary: re-authorize a bound conversation attachment before issuing one short-lived signed download. */
import { NextResponse } from "next/server";

import { maxPrivateSignedUrlSeconds } from "@/lib/security/file-access";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ attachmentId: string }> }>
) {
  const { attachmentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId))
    return new NextResponse("Not found", { status: 404 });
  const [session, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase)
    return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.rpc(
    "get_communication_attachment_download_target",
    { requested_attachment_id: attachmentId }
  );
  if (error || !data || typeof data !== "object")
    return new NextResponse("Not found", { status: 404 });
  const target = data as {
    bucket?: unknown;
    object_key?: unknown;
    original_filename?: unknown;
  };
  if (
    typeof target.bucket !== "string" ||
    typeof target.object_key !== "string" ||
    typeof target.original_filename !== "string"
  )
    return new NextResponse("Not found", { status: 404 });
  const { data: signed, error: signedError } = await supabase.storage
    .from(target.bucket)
    .createSignedUrl(target.object_key, maxPrivateSignedUrlSeconds, {
      download: target.original_filename,
    });
  if (signedError || !signed?.signedUrl)
    return new NextResponse("File unavailable", { status: 503 });
  return NextResponse.redirect(signed.signedUrl);
}
