"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

export function ContactChallenge({ siteKey, reset, onToken }: { siteKey: string; reset: number; onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [error, setError] = useState(false);
  const mount = useCallback(() => {
    if (!element.current || !window.turnstile || widget.current !== null) return;
    try {
      widget.current = window.turnstile.render(element.current, {
        sitekey: siteKey, action: "contact", size: "compact", language: "ja", theme: "light",
        callback: (token: string) => { setError(false); onToken(token); },
        "expired-callback": () => onToken(""),
        "error-callback": () => { onToken(""); setError(true); },
      });
    } catch { setError(true); }
  }, [onToken, siteKey]);

  useEffect(() => {
    // Mount from an external script/animation callback, not synchronous state
    // changes in an effect. This also supports Next Script's cached navigation.
    const frame = requestAnimationFrame(mount);
    return () => { cancelAnimationFrame(frame); if (widget.current !== null) window.turnstile?.remove(widget.current); widget.current = null; };
  }, [mount]);
  useEffect(() => {
    if (widget.current !== null) window.turnstile?.reset(widget.current);
  }, [reset]);

  return <div className="contact-challenge">
    <p className="hint">スパム対策の確認（必須）。読み込み後、確認が完了すると送信できます。</p>
    <div ref={element} />
    {error && <p role="alert">確認を読み込めませんでした。入力内容を控えてからページを再読み込みしてください。</p>}
    <Script id="contact-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={mount} onError={() => { onToken(""); setError(true); }} />
  </div>;
}
