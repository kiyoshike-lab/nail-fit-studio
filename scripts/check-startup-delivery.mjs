import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { importTypescript } from "./lib/import-typescript.mjs";

const route = await importTypescript("app/model-assets/hand-landmarker/route.ts");
assert.equal(route.dynamic, "force-static");
assert.equal(route.runtime, "nodejs");
const response = await route.GET();
const encoded = Buffer.from(await response.arrayBuffer());
const source = await readFile("public/mediapipe/hand_landmarker.task");
assert.equal(response.headers.get("content-encoding"), "gzip");
assert.equal(response.headers.get("content-type"), "application/octet-stream");
assert.equal(response.headers.get("vary"), "Accept-Encoding");
assert.equal(Number(response.headers.get("content-length")), encoded.length);
assert.ok(gunzipSync(encoded).equals(source), "model weights changed in transit");
assert.ok(encoded.length < source.length * 0.8, "transport compression regressed");
assert.equal(response.headers.get("etag"), (await route.GET()).headers.get("etag"));

const config = await readFile("next.config.ts", "utf8");
assert.ok(config.includes("beforeFiles:"));
assert.ok(config.includes('source: "/mediapipe/hand_landmarker.task"'));
assert.ok(config.includes('key: "accept-encoding"'));
const pattern = new RegExp(JSON.parse(config.match(/value: ("(?:[^"\\]|\\.)*")/)[1]));
for (const value of ["gzip", "gzip, deflate, br", "br, gzip", "deflate, gzip, br, zstd"])
  assert.ok(pattern.test(value), value);
for (const value of ["identity", "br", "gzip;q=0", "notgzip"])
  assert.equal(pattern.test(value), false, value);
assert.equal(
  await readFile("public/googlef4620872cc6591de.html", "utf8"),
  "google-site-verification: googlef4620872cc6591de.html",
);
console.log(`startup-delivery: ${source.length} -> ${encoded.length} bytes; lossless gzip, build-time route, encoding negotiation, original SDK URL and verification file passed`);

// Optional production-server check. No requests to external sites or deployment.
const args = process.argv.slice(2);
if (args.includes("--base-url")) {
  const base = new URL(args[args.indexOf("--base-url") + 1]);
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Local QA only");
  for (const encoding of ["gzip, deflate, br", "identity", "gzip;q=0"]) {
    const result = await fetch(new URL("/mediapipe/hand_landmarker.task", base), {
      headers: { "Accept-Encoding": encoding },
    });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("content-encoding"), encoding.startsWith("gzip,") ? "gzip" : null);
    assert.ok(Buffer.from(await result.arrayBuffer()).equals(source), "HTTP-decoded model changed");
    if (encoding.startsWith("gzip,")) {
      assert.equal(Number(result.headers.get("content-length")), encoded.length);
      assert.match(result.headers.get("vary"), /accept-encoding/i);
    }
  }
  const verification = await fetch(new URL("/googlef4620872cc6591de.html", base));
  assert.equal(verification.status, 200);
  assert.equal(await verification.text(), "google-site-verification: googlef4620872cc6591de.html");
  console.log("production HTTP: gzip/identity/q=0 negotiation, decoded bytes and Search Console file passed");
}
