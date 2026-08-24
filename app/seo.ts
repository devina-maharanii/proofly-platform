const configuredPublicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(
  /\/$/,
  ""
);

export const siteConfig = {
  name: "Proofly",
  description:
    "Proofly makes real software work visible, reviewable, and understandable before opportunity decisions.",
  publicUrl:
    configuredPublicUrl && /^https:\/\//.test(configuredPublicUrl)
      ? configuredPublicUrl
      : undefined,
  metadataBase: new URL(
    configuredPublicUrl && /^https:\/\//.test(configuredPublicUrl)
      ? configuredPublicUrl
      : "http://localhost:3000"
  ),
} as const;

export const publicRouteContract = [
  {
    pathname: "/",
    title: "Proofly — Trusted opportunities through real work",
    description: siteConfig.description,
    indexable: true,
  },
] as const;

export function canonicalUrl(pathname = "/") {
  return new URL(pathname, siteConfig.metadataBase).toString();
}
