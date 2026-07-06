import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "manifest.json");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
    return null;
  }
}

function requireFile(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`Missing required file: ${relativePath}`);
    return false;
  }
  pass(`Found ${relativePath}`);
  return true;
}

function pngDimensions(relativePath) {
  const buffer = readFileSync(join(root, relativePath));
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("not a PNG file");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function checkJavaScript(relativePath) {
  try {
    execFileSync("node", ["--check", relativePath], { cwd: root, stdio: "pipe" });
    pass(`JavaScript syntax OK: ${relativePath}`);
  } catch (error) {
    fail(`JavaScript syntax failed: ${relativePath}\n${String(error.stderr || error.message)}`);
  }
}

const manifest = readJson(manifestPath);
if (!manifest) {
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  fail("manifest_version must be 3");
} else {
  pass("Manifest V3 detected");
}

if (manifest.name !== "这是啥来着") {
  fail("manifest name must be “这是啥来着”");
} else {
  pass("Extension name is correct");
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) {
  fail("manifest version must use x.y.z format");
} else {
  pass(`Version ${manifest.version}`);
}

const requiredFiles = new Set([
  "manifest.json",
  "README.md",
  "LICENSE",
  "src/background/background.js",
  "src/shared/constants.js",
  "src/content/content.js",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "src/options/options.html",
  "src/options/options.css",
  "src/options/options.js",
  "src/history/history.html",
  "src/history/history.css",
  "src/history/history.js"
]);

for (const iconPath of Object.values(manifest.icons || {})) {
  requiredFiles.add(iconPath);
}

if (manifest.background?.service_worker) {
  requiredFiles.add(manifest.background.service_worker);
}

for (const script of manifest.content_scripts || []) {
  for (const jsPath of script.js || []) {
    requiredFiles.add(jsPath);
  }
}

if (manifest.action?.default_popup) {
  requiredFiles.add(manifest.action.default_popup);
}

if (manifest.options_page) {
  requiredFiles.add(manifest.options_page);
}

for (const relativePath of requiredFiles) {
  requireFile(relativePath);
}

for (const [declaredSize, iconPath] of Object.entries(manifest.icons || {})) {
  try {
    const dimensions = pngDimensions(iconPath);
    const expected = Number(declaredSize);
    if (dimensions.width !== expected || dimensions.height !== expected) {
      fail(`${iconPath} is ${dimensions.width}x${dimensions.height}, expected ${expected}x${expected}`);
    } else {
      pass(`${iconPath} dimensions are ${expected}x${expected}`);
    }
  } catch (error) {
    fail(`${iconPath}: ${error.message}`);
  }
}

[
  "src/background/background.js",
  "src/shared/constants.js",
  "src/content/content.js",
  "src/popup/popup.js",
  "src/options/options.js",
  "src/history/history.js"
].forEach(checkJavaScript);

if (process.exitCode) {
  console.error("\nExtension validation failed.");
  process.exit(process.exitCode);
}

console.log("\nExtension validation passed.");
