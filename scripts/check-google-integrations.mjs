import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const expectedGaId = "G-CLEJWK7RF3";
const oldGaId = "G-ZP8CENKEDH";
const expectedPublisher = "ca-pub-6994120027205290";
const expectedAdsTxtLine = "google.com, pub-6994120027205290, DIRECT, f08c47fec0942fa0";

const [layout, analytics, adSlot, config, adsTxtRoute, envExample, events, adPlacement] = await Promise.all([
  readFile("app/layout.tsx", "utf8"),
  readFile("src/components/GoogleAnalytics.tsx", "utf8"),
  readFile("src/components/AdSlot.tsx", "utf8"),
  readFile("src/lib/googleConfig.ts", "utf8"),
  readFile("app/ads.txt/route.ts", "utf8"),
  readFile(".env.example", "utf8"),
  readFile("src/lib/analytics.ts", "utf8"),
  readFile("scripts/check-ad-placement.mjs", "utf8"),
]);

assert.ok(config.includes(`DEFAULT_GA_MEASUREMENT_ID = "${expectedGaId}"`));
assert.ok(config.includes(`DEFAULT_ADSENSE_PUBLISHER_ID = "${expectedPublisher}"`));
const compiledConfig = ts.transpileModule(config, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const googleConfig = await import(`data:text/javascript;base64,${Buffer.from(compiledConfig).toString("base64")}`);
assert.equal(googleConfig.ADSENSE_ADS_TXT_LINE, expectedAdsTxtLine);
assert.ok(adsTxtRoute.includes("`${ADSENSE_ADS_TXT_LINE}\\n`"));
assert.ok(envExample.includes(`NEXT_PUBLIC_GA_ID=${expectedGaId}`));
assert.ok(envExample.includes(`NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=${expectedPublisher}`));
assert.ok(layout.includes('other: { "google-adsense-account": ADSENSE_PUBLISHER_ID }'));
assert.equal((layout.match(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/g) ?? []).length, 1, "AdSense loader is not global or is duplicated");
assert.ok(layout.includes('id="google-adsense"'));
assert.ok(layout.includes('crossOrigin="anonymous"'));
assert.equal(adSlot.includes("pagead2.googlesyndication.com"), false, "AdSlot still loads a duplicate AdSense script");
assert.equal((layout.match(/<GoogleAnalytics\s*\/>/g) ?? []).length, 1, "GoogleAnalytics is rendered more than once");
assert.equal((analytics.match(/googletagmanager\.com\/gtag\/js/g) ?? []).length, 1, "GA loader is duplicated");
assert.ok(analytics.includes("gtag('js',new Date())"));
assert.ok(analytics.includes("gtag('config','${GA_MEASUREMENT_ID}'"));

for (const event of [
  "tryon_started", "photo_uploaded", "nail_design_selected", "tryon_saved", "tryon_shared",
  "diagnosis_started", "diagnosis_completed", "favorite_added", "guide_read", "guide_to_tryon",
]) {
  assert.ok(events.includes(`"${event}"`), `GA4 event was removed: ${event}`);
}

for (const route of ["app/try-on/page.tsx", "app/diagnosis/page.tsx", "app/favorites/page.tsx", "app/history/page.tsx"]) {
  assert.ok(adPlacement.includes(`"${route}"`), `AdSense exclusion is missing: ${route}`);
}

const sourceFiles = await listSourceFiles(".");
const oldIdLocations = [];
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  if (source.includes(oldGaId) && file !== path.normalize("scripts/check-google-integrations.mjs")) oldIdLocations.push(file);
}
assert.deepEqual(oldIdLocations, [], `Old GA ID remains in: ${oldIdLocations.join(", ")}`);

console.log("google-integrations: AdSense meta/ads.txt, GA4 singleton, events and route exclusions passed");

async function listSourceFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "public"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listSourceFiles(target));
    else if (/\.(?:ts|tsx|js|mjs|json|md|example)$/.test(entry.name) || entry.name === ".env.example") result.push(target);
  }
  return result;
}
