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

function isManifestMessage(value) {
  return /^__MSG_[A-Za-z0-9_]+__$/.test(value || "");
}

function requireLocaleMessage(locale, key) {
  const path = join(root, "_locales", locale, "messages.json");
  const messages = readJson(path);
  if (!messages?.[key]?.message) {
    fail(`Missing _locales/${locale}/messages.json message: ${key}`);
  } else {
    pass(`Locale ${locale} has ${key}`);
  }
}

const manifest = readJson(manifestPath);
const packageJson = readJson(join(root, "package.json"));
if (!manifest) {
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  fail("manifest_version must be 3");
} else {
  pass("Manifest V3 detected");
}

if (manifest.name !== "这是啥来着" && !isManifestMessage(manifest.name)) {
  fail("manifest name must be “这是啥来着” or a __MSG_*__ locale reference");
} else {
  pass("Extension name is correct");
}

if (manifest.default_locale !== "zh_CN") {
  fail("default_locale must be zh_CN when manifest locale messages are used");
} else {
  pass("Default locale is zh_CN");
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) {
  fail("manifest version must use x.y.z format");
} else {
  pass(`Version ${manifest.version}`);
}

if (packageJson?.version !== manifest.version) {
  fail("package.json and manifest.json versions must match");
} else {
  pass("Package and manifest versions match");
}

if (!(manifest.permissions || []).includes("clipboardWrite") || (manifest.permissions || []).includes("clipboardRead")) {
  fail("Annotation fallback requires clipboardWrite and must not request clipboardRead");
} else {
  pass("Clipboard permission is write-only");
}

const requiredFiles = new Set([
  "manifest.json",
  "README.md",
  "README.en.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "CONTRIBUTING.en.md",
  "SECURITY.md",
  "SECURITY.en.md",
  "_locales/zh_CN/messages.json",
  "_locales/en/messages.json",
  "docs/index.html",
  "docs/en/index.html",
  "docs/styles.css",
  "docs/assets/hero-product.jpg",
  "docs/assets/icon128.png",
  "src/background/background.js",
  "src/shared/constants.js",
  "src/shared/annotations.js",
  "src/shared/settings-form.js",
  "src/shared/onboarding.js",
  "src/content/annotation-runtime.js",
  "src/content/content-ui.js",
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
  ,"src/onboarding/onboarding.html"
  ,"src/onboarding/onboarding.css"
  ,"src/onboarding/onboarding.js"
  ,"tests/annotation-format.test.mjs"
  ,"tests/annotation-state.test.mjs"
  ,"tests/annotation-match.test.mjs"
  ,"tests/annotation-storage.test.mjs"
  ,"tests/content-ui.test.mjs"
  ,"tests/onboarding-state.test.mjs"
  ,"tests/fixtures/annotation-playground.html"
  ,"tools/serve-fixtures.mjs"
]);

for (const iconPath of Object.values(manifest.icons || {})) {
  requiredFiles.add(iconPath);
}

for (const iconPath of Object.values(manifest.action?.default_icon || {})) {
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

const expectedContentOrder = ["src/shared/constants.js", "src/shared/annotations.js", "src/content/annotation-runtime.js", "src/content/content-ui.js", "src/content/content.js"];
const loadedScripts = manifest.content_scripts?.[0]?.js || [];
if (expectedContentOrder.some((script, index) => loadedScripts[index] !== script)) {
  fail("Annotation content scripts are not loaded in dependency order");
} else {
  pass("Annotation content script order is correct");
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

for (const locale of ["zh_CN", "en"]) {
  for (const key of ["extensionName", "extensionDescription", "extensionActionTitle"]) {
    requireLocaleMessage(locale, key);
  }
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

for (const [declaredSize, iconPath] of Object.entries(manifest.action?.default_icon || {})) {
  try {
    const dimensions = pngDimensions(iconPath);
    const expected = Number(declaredSize);
    if (dimensions.width !== expected || dimensions.height !== expected) {
      fail(`action default_icon ${iconPath} is ${dimensions.width}x${dimensions.height}, expected ${expected}x${expected}`);
    } else {
      pass(`Action icon ${iconPath} dimensions are ${expected}x${expected}`);
    }
  } catch (error) {
    fail(`action default_icon ${iconPath}: ${error.message}`);
  }
}

[
  "src/background/background.js",
  "src/shared/constants.js",
  "src/shared/annotations.js",
  "src/shared/settings-form.js",
  "src/shared/onboarding.js",
  "src/content/annotation-runtime.js",
  "src/content/content-ui.js",
  "src/content/content.js",
  "src/popup/popup.js",
  "src/options/options.js",
  "src/history/history.js"
  ,"src/onboarding/onboarding.js"
].forEach(checkJavaScript);

if (process.exitCode) {
  console.error("\nExtension validation failed.");
  process.exit(process.exitCode);
}

console.log("\nExtension validation passed.");
