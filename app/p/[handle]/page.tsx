/** Phase 20 compatibility route: permanent redirect to the stable public evidence profile. */
import { permanentRedirect } from "next/navigation";

export default async function LegacyPublicProfilePage({
  params,
}: Readonly<{ params: Promise<{ handle: string }> }>) {
  const { handle } = await params;
  const target = `/talent/${encodeURIComponent(handle)}`;
  permanentRedirect(target as never);
}
