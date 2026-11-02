import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

// Pre-render once at build time, not compression work on every camera request.
// The original public asset and SDK URL stay intact for compatibility.
export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  const source = await readFile(join(process.cwd(), "public/mediapipe/hand_landmarker.task"));
  const body = gzipSync(source, { level: 9 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "gzip",
      "Vary": "Accept-Encoding",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate",
      "ETag": `"${createHash("sha256").update(body).digest("hex")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
