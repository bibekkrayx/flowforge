/**
 * Next/Turbopack + Tailwind v4 resolve `@import "tailwindcss"` from the git
 * root when PostCSS has no `from` option (parent of cwd). Link CSS packages
 * there so compilation can find them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parentModules = path.resolve(frontendRoot, "..", "node_modules");

fs.mkdirSync(parentModules, { recursive: true });

for (const pkg of ["tailwindcss", "tw-animate-css", "shadcn"]) {
  const target = path.join(frontendRoot, "node_modules", pkg);
  const link = path.join(parentModules, pkg);
  if (!fs.existsSync(target)) continue;

  try {
    fs.lstatSync(link);
    fs.rmSync(link, { recursive: true });
  } catch {
    // no existing entry
  }

  fs.symlinkSync(target, link);
}
