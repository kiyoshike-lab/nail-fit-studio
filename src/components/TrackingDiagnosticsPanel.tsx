"use client";

import { useEffect, useState } from "react";
import { configureDiagnosticEnvironment, diagnosticsEnabled, enableTrackingDiagnostics, readTrackingDiagnostics, type TrackingDiagnostic } from "@/lib/trackingDiagnostics";

const stages = {
  idle: "待機", "A-camera": "A：カメラ起動", "B-initialization": "B：認識エンジン起動",
  "C-frames": "C：動画フレーム待ち", "D-no-hands": "D：推論済み・手が0件",
  "D-inference-error": "D：推論処理でエラー",
  "E-geometry": "E：爪位置計算", "F-visibility": "F：可視性による非表示",
  "G-render": "G：Canvas描画を確認", tracking: "追尾中",
};

export function TrackingDiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState<TrackingDiagnostic | null>(null);
  const [copy, setCopy] = useState("");
  const [fallback, setFallback] = useState("");
  useEffect(() => {
    // Explicit URL opt-in only. No persistence, network upload or analytics.
    if (new URLSearchParams(window.location.search).get("diagnostics") !== "1") return;
    enableTrackingDiagnostics(); configureDiagnosticEnvironment();
    const timer = window.setInterval(() => {
      if (diagnosticsEnabled()) setSnapshot(readTrackingDiagnostics());
    }, 500);
    return () => { window.clearInterval(timer); enableTrackingDiagnostics(false); };
  }, []);
  if (!snapshot) return null;
  async function copyResult() {
    const json = JSON.stringify(readTrackingDiagnostics(), null, 2);
    try { await navigator.clipboard.writeText(json); setCopy("診断結果をコピーしました"); setFallback(""); }
    catch { setFallback(json); setCopy("下のテキストを選択してコピーしてください"); }
  }
  const { environment: e, camera: c, engine, inference: i, nails: n, performance: p } = snapshot;
  return <details className="tracking-diagnostics" open>
    <summary>手認識の診断（明示的に有効化中）</summary>
    <p role="status">{stages[snapshot.stage]}</p>
    <dl>
      <dt>環境</dt><dd>{e.os} / {e.browser} / HTTPS等の安全な接続：{e.secure ? "はい" : "いいえ"}</dd>
      <dt>カメラ</dt><dd>{c.state} / {c.width}×{c.height} / readyState {c.readyState} / {c.currentTime.toFixed(2)}秒 / 更新 {c.updates} / 停止 {String(c.paused)}</dd>
      <dt>認識エンジン</dt><dd>{engine.state} / {engine.delegate ?? "未決定"} / 起動試行 {engine.attempts} / {engine.initializationMs?.toFixed(0) ?? "—"}ms</dd>
      <dt>推論</dt><dd>実行 {i.attempts} / 成功 {i.successes} / エラー {i.errors} / 手0件 {i.emptyResults} / {i.input} {i.width}×{i.height}</dd>
      <dt>認識結果</dt><dd>手 {i.hands} / ランドマーク {i.landmarks} / 爪推定 {n.estimated} / 表示候補 {n.eligible} / 描画呼出 {n.rendered}本</dd>
      <dt>Canvas</dt><dd>{n.canvasWidth}×{n.canvasHeight} / 不透明度 {n.canvasOpacity.toFixed(2)} / Before {String(n.before)} / 手動表示 {String(n.manual)} / {n.drawMs.toFixed(1)}ms / {n.drawFps.toFixed(1)}fps</dd>
      <dt>負荷</dt><dd>カメラ {p.cameraFps?.toFixed(1) ?? "—"}fps / 推論 {p.detectionFps.toFixed(1)}fps / {i.lastMs.toFixed(1)}ms / 実行間隔 {i.actualIntervalMs?.toFixed(0) ?? "—"}ms（下限 {i.intervalMs.toFixed(0)}ms） / JSメモリ {p.memoryMB?.toFixed(1) ?? "取得不可"}MB</dd>
      <dt>最後のエラー</dt><dd>{snapshot.lastError ? `${snapshot.lastError.phase} / ${snapshot.lastError.name} / ${snapshot.lastError.code}` : "なし"}</dd>
    </dl>
    <p>画像・座標・カメラ名・端末ID・認証情報は含みません。描画呼出本数は、画面に見えるピクセル数の保証ではありません。</p>
    <button type="button" className="secondary" onClick={() => { void copyResult(); }}>診断結果をコピー</button>
    <span role="status">{copy}</span>
    {fallback && <textarea aria-label="コピー用の診断結果" readOnly value={fallback} rows={8} onFocus={event => event.currentTarget.select()} />}
    <p>通常表示へ戻すにはURLの「?diagnostics=1」を外してください。</p>
  </details>;
}
