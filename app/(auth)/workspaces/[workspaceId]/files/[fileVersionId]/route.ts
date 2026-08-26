/** Phase 26 route: the server re-authorizes an exact private file version, then issues one short-lived signed download; no browser object key is accepted. */
import { NextResponse } from "next/server";

import { maxPrivateSignedUrlSeconds } from "@/lib/security/file-access";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  {
    params,
  }: Readonly<{
    params: Promise<{ workspaceId: string; fileVersionId: string }>;
  }>
) {
  const { workspaceId, fileVersionId } = await params;
  if (
    !/^[0-9a-f-]{36}$/i.test(workspaceId) ||
    !/^[0-9a-f-]{36}$/i.test(fileVersionId)
  )
    return new NextResponse("Not found", { status: 404 });
  const [session, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase)
    return new NextResponse("Not found", { status: 404 });
  const { data: target, error } = await supabase.rpc(
    "get_project_workspace_file_download_target",
    { requested_file_version_id: fileVersionId }
  );
  if (error || !target || typeof target !== "object")
    return new NextResponse("Not found", { status: 404 });
  const record = target as {
    bucket?: unknown;
    object_key?: unknown;
    original_filename?: unknown;
  };
  if (
    typeof record.bucket !== "string" ||
    typeof record.object_key !== "string" ||
    typeof record.original_filename !== "string"
  )
    return new NextResponse("Not found", { status: 404 });
  const { data: signed, error: signedError } = await supabase.storage
    .from(record.bucket)
    .createSignedUrl(record.object_key, maxPrivateSignedUrlSeconds, {
      download: record.original_filename,
    });
  if (signedError || !signed?.signedUrl)
    return new NextResponse("File unavailable", { status: 503 });
  return NextResponse.redirect(signed.signedUrl);
}
