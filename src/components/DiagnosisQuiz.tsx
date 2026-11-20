"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { diagnosisQuestions, diagnosisTryOnUrl, differentDiagnosisPattern, finishNames, patternNames, recommendNails, shapeNames } from "@/lib/nailDiagnosis";
import { readDiagnosisResult, STORAGE_KEYS, tryWriteJson } from "@/lib/storage";
import type { DiagnosisResult } from "@/lib/types";
import { DiagnosisPhotoReview } from "./DiagnosisPhotoReview";
import { ShowcaseTiles } from "./ShowcaseTiles";
import { showcaseExamples } from "@/lib/showcaseCatalog";

export function DiagnosisQuiz() {
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [persistenceNotice, setPersistenceNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);
  const started = useRef(false);
  const step = answers.length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!started.current) setResult(readDiagnosisResult());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (moveFocus.current) {
      heading.current?.focus({ preventScroll: true });
      moveFocus.current = false;
    }
  }, [step, result]);

  function answer(value: string) {
    if (!started.current) { started.current = true; trackEvent("diagnosis_started"); }
    moveFocus.current = true;
    const next = [...answers, value];
    setAnswers(next);
    if (next.length === diagnosisQuestions.length) {
      const recommendation = recommendNails(next);
      setResult(recommendation);
      setPersistenceNotice(tryWriteJson(STORAGE_KEYS.diagnosis, recommendation) ? "" : "診断は完了しました。このブラウザには保存できませんでした。");
      trackEvent("diagnosis_completed", { result: recommendation.title });
    }
  }

  if (result) {
    const alternate = differentDiagnosisPattern(result);
    return <section aria-labelledby="diagnosis-result-title">
    <div className="diagnosis-result">
      <p className="eyebrow">あなたへのおすすめ</p>
      <h2 id="diagnosis-result-title" ref={heading} tabIndex={-1}>{result.title}</h2>
      <dl className="diagnosis-summary">
        <div><dt>色</dt><dd><span className="diagnosis-swatch" style={{ backgroundColor: result.color }} />{result.color.toUpperCase()}</dd></div>
        <div><dt>質感</dt><dd>{result.finish ? finishNames[result.finish] : "試着で選ぶ"}</dd></div>
        <div><dt>形・長さ</dt><dd>{shapeNames[result.shape]}・{result.length === "short" ? "短め" : result.length === "long" ? "長め" : "標準"}</dd></div>
        <div><dt>デザイン</dt><dd>{patternNames[result.pattern]}</dd></div>
      </dl>
      <p>{result.description}</p>
      {persistenceNotice && <p role="status">{persistenceNotice}</p>}
      <div className="hero-actions">
        <Link className="button light" href={diagnosisTryOnUrl(result)}>この条件で試着する</Link>
        <button type="button" className="secondary" onClick={() => {
          started.current = true; moveFocus.current = true; setAnswers([]); setResult(null); setPersistenceNotice(""); trackEvent("diagnosis_started");
        }}>もう一度診断</button>
      </div>
    </div>
    <div className="panel-card diagnosis-photo-review">
      <h3>同じ色で、柄だけ変えて比べる</h3>
      <p className="hint">色・形・長さ・質感はそのまま。診断結果を書き換えずに試せます。</p>
      <Link className="button ghost" href={diagnosisTryOnUrl(alternate)} prefetch={false}>
        {patternNames[alternate.pattern]}で試す
      </Link>
    </div>
    <DiagnosisPhotoReview result={result} />
    <details className="panel-card diagnosis-photo-review">
      <summary>別のデザインを作例から探す</summary>
      <p className="hint">診断結果とは別の候補です。生成した手写真での試着作例で、実際の施術写真ではありません。</p>
      <ShowcaseTiles examples={showcaseExamples.slice(0,2)} compact />
      <Link href="/#nail-examples">全12種類の作例を見る →</Link>
    </details>
  </section>;
  }

  const question = diagnosisQuestions[step] ?? diagnosisQuestions[0];
  return <div className="diagnosis-card">
    <div className="diagnosis-progress" role="progressbar" aria-label="診断の進み具合" aria-valuemin={0} aria-valuemax={diagnosisQuestions.length} aria-valuenow={step}><span style={{ width: `${Math.max(6, step / diagnosisQuestions.length * 100)}%` }} /></div>
    <p className="eyebrow">質問 {step + 1} / {diagnosisQuestions.length}</p>
    <h2 ref={heading} tabIndex={-1}>{question.title}</h2>
    {step === 0 && <p className="hint">写真なしで診断できます。手写真は、結果を見たあとに比較したいときだけ使えます。</p>}
    <div className="option-list">{question.options.map(([label,value]) => <button type="button" key={value} onClick={() => answer(value)}>{label}</button>)}</div>
    {step > 0 && <button type="button" className="secondary" onClick={() => { moveFocus.current = true; setAnswers(answers.slice(0,-1)); }}>ひとつ戻る</button>}
  </div>;
}
