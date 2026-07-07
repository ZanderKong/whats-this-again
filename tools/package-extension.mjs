import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");
const zipName = "whats-this-again.zip";

execFileSync("node", ["tools/validate-extension.mjs"], { cwd: root, stdio: "inherit" });

mkdirSync(distDir, { recursive: true });
rmSync(join(distDir, zipName), { force: true });

const include = [
  "manifest.json",
  "README.md",
  "README.en.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING.en.md",
  "SECURITY.md",
  "SECURITY.en.md",
  "_locales",
  "assets",
  "docs",
  "src",
  "tools",
  "package.json"
];

execFileSync("zip", ["-r", join("dist", zipName), ...include, "-x", "*.DS_Store"], {
  cwd: root,
  stdio: "inherit"
});

console.log(`\nCreated dist/${zipName}`);
