/* global process */

import { lstatSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const rootArgument = process.argv[2];
const maxBytes = Number.parseInt(
  process.env.DESKTOP_PACKAGE_MAX_BYTES ?? String(768 * 1024 * 1024),
  10,
);

if (!rootArgument || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
  throw new Error(
    "Usage: node scripts/check-desktop-artifact-sizes.mjs <bundle-root> " +
      "[DESKTOP_PACKAGE_MAX_BYTES=<positive integer>]",
  );
}

const bundleRoot = resolve(rootArgument);
const fileSuffixes = [".dmg", ".exe", ".msi", ".deb", ".AppImage"];
const packageDirectories = new Set(["dmg", "nsis", "msi", "deb", "appimage"]);
const packages = [];

function directorySize(path) {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return total + directorySize(child);
    return total + lstatSync(child).size;
  }, 0);
}

function discover(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      packages.push({ path: child, size: directorySize(child) });
    } else if (entry.isDirectory()) {
      discover(child);
    } else if (
      packageDirectories.has(basename(path)) &&
      fileSuffixes.some((suffix) => entry.name.endsWith(suffix))
    ) {
      packages.push({ path: child, size: lstatSync(child).size });
    }
  }
}

discover(bundleRoot);

if (packages.length === 0) {
  throw new Error(`No desktop packages found beneath ${bundleRoot}.`);
}

for (const desktopPackage of packages) {
  const sizeMiB = (desktopPackage.size / 1024 / 1024).toFixed(1);
  process.stdout.write(`${basename(desktopPackage.path)}: ${sizeMiB} MiB\n`);
  if (desktopPackage.size > maxBytes) {
    throw new Error(
      `${desktopPackage.path} exceeds the ${(maxBytes / 1024 / 1024).toFixed(0)} MiB package limit.`,
    );
  }
}
