import { createHash, randomBytes } from "node:crypto";
import type { ContactConfiguration } from "./contactConfiguration";
import { contactKinds, validateContact } from "./contactValidation";

const maxBytes = 16 * 1024;
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const json = (status: number, message: string, extra: object = {}) => Response.json({ message, ...extra }, { status, headers });

// Supplementary, bounded per-instance limiter. Not a distributed guarantee:
// mandatory Formspree server-verified Turnstile + provider limits are primary.
export function contactRateLimiter(now = () => Date.now()) {
  const salt = randomBytes(16).toString("hex");
  const entries = new Map<string, { count: number; until: number }>();
  let globalCount = 0, globalUntil = 0;
  return (client: string) => {
    const time = now();
    if (time >= globalUntil) { globalUntil = time + 60_000; globalCount = 0; }
    if (++globalCount > 20) return false;
    for (const [key, entry] of entries) if (entry.until <= time) entries.delete(key);
    const key = createHash("sha256").update(salt + client.slice(0, 200)).digest("hex");
    const entry = entries.get(key) ?? { count: 0, until: time + 600_000 };
    if (!entries.has(key) && entries.size >= 1000) return false;
    entries.set(key, entry);
    return ++entry.count <= 5;
  };
}

async function readBoundedJson(request: Request) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}

type Dependencies = { fetch: typeof fetch; allow: (client: string) => boolean };

export async function handleContact(request: Request, config: ContactConfiguration, dependencies: Dependencies): Promise<Response> {
  const origin = request.headers.get("origin"), url = new URL(request.url);
  let source: URL;
  try { source = new URL(origin ?? ""); } catch { return json(403, "送信元を確認できませんでした。"); }
  // Next may expose an internal localhost URL in Route Handlers. Compare the
  // browser Origin to the actual HTTP Host, not that rewritten internal URL.
  // Never trust an arbitrary X-Forwarded-Host supplied by a client.
  const host = request.headers.get("host")?.toLowerCase() ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? url.protocol.slice(0, -1);
  if (source.origin !== origin || source.host !== host || source.protocol !== `${protocol}:` || !["http:", "https:"].includes(source.protocol) || request.headers.get("sec-fetch-site") === "cross-site") return json(403, "送信元を確認できませんでした。このサイトからもう一度お試しください。");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json(415, "送信形式を確認できませんでした。");
  if (!config.ready) return json(503, "お問い合わせフォームは現在準備中です。まだ送信されていません。");
  if (!dependencies.allow(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")) return json(429, "送信回数が多くなっています。時間をおいてお試しください。");
  let input: unknown;
  try { input = await readBoundedJson(request); }
  catch (error) { return json(error instanceof RangeError ? 413 : 400, "入力内容またはデータの大きさを確認してください。"); }
  const result = validateContact(input);
  if (!result.fields) return json(400, "入力内容を確認してください。", { errors: result.errors });
  const data = input as Record<string, unknown>;
  // Do not accept attachments, recipient overrides, or arbitrary provider fields.
  if (Object.keys(data).some(key => !["name", "email", "kind", "message", "website", "token"].includes(key)) || (data.website !== undefined && data.website !== "")) return json(400, "送信内容を確認できませんでした。");
  if (typeof data.token !== "string" || !data.token || data.token.length > 2048) return json(400, "スパム対策の確認を完了してから送信してください。");

  const { name, email, kind, message } = result.fields;
  try {
    const response = await dependencies.fetch(`https://formspree.io/f/${config.formId}`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Origin: source.origin, Referer: `${source.origin}/contact` },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
      // Formspree validates this single-use token server-side with the secret
      // stored in its private CAPTCHA settings. Do NOT pre-consume the token.
      body: JSON.stringify({ ...(name ? { name } : {}), ...(email ? { email } : {}), category: contactKinds[kind], message, _subject: `Nail Fit Studio お問い合わせ：${contactKinds[kind]}`, "cf-turnstile-response": data.token }),
    });
    if (response.status === 429) return json(429, "受付件数の上限に達しています。時間をおいてお試しください。");
    if (response.status === 400 || response.status === 422) return json(400, "入力内容またはスパム対策の確認に失敗しました。確認をやり直してください。");
    const receipt = await response.json();
    if (!response.ok || receipt.ok !== true) return json(502, "送信先で受け付けを確認できませんでした。入力内容は残しています。");
    return json(200, "お問い合わせを受け付けました。返信先を入力した場合は、管理者からの連絡をお待ちください。", { ok: true });
  } catch {
    // A provider may have accepted a timed-out request: never claim a delivery
    // or retry automatically (which could duplicate the inquiry).
    return json(502, "受け付けの結果を確認できませんでした。再送すると重複する可能性があります。時間をおいて確認してください。");
  }
}
