import Image from "next/image";

const MARK_URL = "/manus-storage/proofly-proof-marker_6b7621d7.png";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand-mark" href="#top" aria-label="Proofly home">
      <span className="brand-glyph" aria-hidden="true">
        <Image
          src={MARK_URL}
          alt=""
          width={36}
          height={36}
          unoptimized
          priority
        />
      </span>
      {!compact ? (
        <span className="brand-wordmark">
          <span>Proofly</span>
          <em>/ evidence</em>
        </span>
      ) : null}
    </a>
  );
}
