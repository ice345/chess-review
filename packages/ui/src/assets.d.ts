/**
 * Brand raster imports.
 *
 * Vite hands back the asset URL as a string; Next.js hands back a static image
 * object. Both shapes are declared here so `brand-mark.tsx` can normalise once
 * instead of every app carrying its own asset module.
 */
declare module "*.png" {
  const asset: string | { src: string };
  export default asset;
}

declare module "*.svg" {
  const asset: string | { src: string };
  export default asset;
}
