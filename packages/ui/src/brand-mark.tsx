import badge from "../assets/brand/brand-badge.png";

/** Vite hands back the asset URL as a string, Next.js hands back a static image
    object. Both are normalised here so no app needs its own asset module, and the
    parameter stays `unknown` because the two installations declare the import
    differently and a union type would narrow to `never` in one of them. */
function assetSource(asset: unknown): string {
  return typeof asset === "string" ? asset : (asset as { src: string }).src;
}

/**
 * The product mark: the authored bishop whose wing follows the piece's diagonal,
 * cut from `logo.png` to the piece alone so it still reads at badge size. The
 * crop and every icon size are derived by `scripts/sync-brand-assets.mjs`.
 *
 */
export const BRAND_MARK_SOURCE = assetSource(badge);

export interface BrandMarkProps {
  /** Accessible name. Leave out for a placement that repeats a visible title. */
  title?: string;
  decorative?: boolean;
}

export function BrandMark({ title = "Open Chess Review", decorative = false }: BrandMarkProps) {
  return <img className="brand-mark-image" src={BRAND_MARK_SOURCE} alt={decorative ? "" : title} draggable={false} />;
}
