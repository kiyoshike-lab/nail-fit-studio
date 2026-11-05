"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { contactKinds, validateContact, type ContactErrors, type ContactFields } from "@/lib/contactValidation";
import { ContactChallenge } from "./ContactChallenge";

const empty: ContactFields = { name: "", email: "", kind: "bug", message: "" };

export function ContactForm({ enabled, siteKey }: { enabled: boolean; siteKey: string }) {
  const [fields, setFields] = useState(empty);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const busy = useRef(false);
  const website = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const update = (key: keyof ContactFields, value: string) => { setFields(current => ({ ...current, [key]: value })); setSuccess(false); setNotice(""); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !enabled) return;
    const validation = validateContact(fields);
    setErrors(validation.errors); setNotice(""); setSuccess(false);
    if (!validation.fields) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()); return; }
    if (!token) { setNotice("スパム対策の確認を完了してください。"); return; }
    busy.current = true; setSending(true);
    // AbortSignal.timeout is absent in some Safari versions. Use the broadly
    // supported controller and always dispose its timer after the request.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validation.fields, website: website.current?.value ?? "", token }),
        signal: controller.signal,
      });
      const receipt = await response.json();
      if (response.ok && receipt.ok === true) {
        setFields(empty); setSuccess(true);
        setNotice("お問い合わせを受け付けました。返信先を入力した場合は、管理者からの連絡をお待ちください。");
      } else {
        // Never echo an arbitrary upstream/body string into the UI.
        const messages: Record<number, string> = {
          400: "入力内容またはスパム対策の確認に問題があります。内容を確認し、もう一度お試しください。",
          413: "送信内容が大きすぎます。本文を短くしてください。",
          429: "受付件数・送信回数の上限に達しています。時間をおいてお試しください。",
          503: "送信の準備または確認ができませんでした。まだ送信されていません。時間をおいてお試しください。",
        };
        setNotice(messages[response.status] ?? "受け付けの結果を確認できませんでした。入力内容は残しています。再送すると重複する可能性があります。");
      }
    } catch {
      setNotice("通信できず、受け付けの結果を確認できませんでした。入力内容は残しています。再送すると重複する可能性があります。");
    } finally {
      window.clearTimeout(timeout);
      busy.current = false; setSending(false); setToken(""); setReset(value => value + 1);
      requestAnimationFrame(() => result.current?.focus());
    }
  }

  return <section className="contact-panel" aria-labelledby="contact-form-title">
    <h2 id="contact-form-title">メールフォームで問い合わせる</h2>
    <p>GitHubアカウントは不要です。本文だけでも送れます。返信を希望する場合はメールアドレスを入力してください。</p>
    {!enabled && <p className="notice" role="status">メールフォームは現在準備中です。まだ送信できません。下のGitHub Issues窓口は引き続き利用できます（アカウントが必要・投稿は公開）。</p>}
    <form ref={form} onSubmit={submit} noValidate aria-busy={sending}>
      <fieldset disabled={!enabled || sending}>
        <legend className="sr-only">お問い合わせ内容</legend>
        <label htmlFor="contact-name">お名前（任意）</label>
        <input id="contact-name" name="name" autoComplete="name" maxLength={80} value={fields.name} onChange={e => update("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "contact-name-error" : undefined} />
        {errors.name && <p id="contact-name-error" className="field-error">{errors.name}</p>}
        <label htmlFor="contact-email">返信先メールアドレス（返信希望時）</label>
        <input id="contact-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={fields.email} onChange={e => update("email", e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "contact-email-error" : "contact-email-hint"} />
        <small id="contact-email-hint">返信が不要な場合は空欄で構いません。</small>
        {errors.email && <p id="contact-email-error" className="field-error">{errors.email}</p>}
        <label htmlFor="contact-kind">問い合わせ種類</label>
        <select id="contact-kind" name="kind" value={fields.kind} onChange={e => update("kind", e.target.value)} aria-invalid={!!errors.kind}>
          {Object.entries(contactKinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="contact-message">問い合わせ本文（必須）</label>
        <textarea id="contact-message" name="message" required rows={7} maxLength={3000} value={fields.message} onChange={e => update("message", e.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? "contact-message-error" : "contact-message-hint"} />
        <small id="contact-message-hint">3000文字以内。パスワードなどの秘密情報は書かないでください。</small>
        {errors.message && <p id="contact-message-error" className="field-error">{errors.message}</p>}
        <div className="contact-honeypot" aria-hidden="true"><label>この欄は入力しないでください<input name="website" ref={website} tabIndex={-1} autoComplete="off" /></label></div>
      </fieldset>
      {enabled && <ContactChallenge siteKey={siteKey} reset={reset} onToken={setToken} />}
      <p className="hint">入力した内容は管理者への連絡のため、Formspreeへ送信されます。スパム対策にはCloudflare Turnstileを利用します。写真やカメラ映像は添付しません。<Link href="/privacy">プライバシーポリシー</Link>をご確認ください。</p>
      <button type="submit" disabled={!enabled || sending || !token}>{sending ? "送信しています…" : "問い合わせを送信"}</button>
      {notice && <p ref={result} tabIndex={-1} className={success ? "contact-result is-success" : "contact-result"} role={success ? "status" : "alert"}>{notice}</p>}
    </form>
  </section>;
}
