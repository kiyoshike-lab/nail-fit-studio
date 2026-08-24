"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { readJson, STORAGE_KEYS, writeJson } from "@/lib/storage";
import type { DiagnosisResult, NailPattern, NailShape } from "@/lib/types";

const questions = [
  { title: "普段の服装に近いものは？", options: [["上品・きれいめ","elegant"],["カジュアル・自然体","natural"],["ガーリー・やわらかい","cute"],["モード・個性的","mode"]] },
  { title: "惹かれる色は？", options: [["ピンク・ローズ","pink"],["ベージュ・ブラウン","warm"],["ブルー・ラベンダー","cool"],["黒・深い色","dark"]] },
  { title: "ネイルを使う場面は？", options: [["仕事・学校","office"],["日常・休日","daily"],["デート・お出かけ","date"],["結婚式・イベント","event"]] },
  { title: "好みの華やかさは？", options: [["ごく自然","soft"],["さりげなく華やか","medium"],["しっかり目立たせたい","bold"]] },
  { title: "使いやすい長さは？", options: [["短め","short"],["ほどよい長さ","medium"],["長め","long"]] },
  { title: "気になる形は？", options: [["丸みのある形","round"],["すっきり縦長","oval"],["先細りで華やか","almond"],["直線的でシャープ","square"]] },
  { title: "職場や学校の制限は？", options: [["かなりある","restricted"],["少しある","some"],["ほとんどない","free"]] },
  { title: "肌になじみやすいと感じるのは？", options: [["黄みのある色","warm-tone"],["青みのある色","cool-tone"],["どちらも好き","neutral-tone"],["分からない","unknown-tone"]] },
] as const;

export function DiagnosisQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setResult(readJson<DiagnosisResult | null>(STORAGE_KEYS.diagnosis, null)), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const question = questions[step];
  const progress = Math.round((step / questions.length) * 100);

  const tryOnUrl = useMemo(() => {
    if (!result) return "/try-on";
    const params = new URLSearchParams({ shape: result.shape, color: result.color, length: result.length, pattern: result.pattern });
    return `/try-on?${params.toString()}`;
  }, [result]);

  function startOver() {
    setAnswers([]); setStep(0); setResult(null); trackEvent("diagnosis_started");
  }

  function answer(value: string) {
    const next = [...answers, value];
    if (step < questions.length - 1) { setAnswers(next); setStep(step + 1); return; }
    const diagnosis = createResult(next);
    setAnswers(next); setResult(diagnosis); writeJson(STORAGE_KEYS.diagnosis, diagnosis); trackEvent("diagnosis_completed", { result: diagnosis.title });
  }

  if (result) {
    return <div className="diagnosis-result"><p className="eyebrow">YOUR NAIL FIT</p><h2>{result.title}</h2><p>{result.description}</p><div className="result-tags">{result.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="hero-actions"><Link className="button light" href={tryOnUrl}>この条件で試着する</Link><button type="button" className="secondary" onClick={startOver}>もう一度診断</button></div></div>;
  }

  return <div className="diagnosis-card"><div className="diagnosis-progress" aria-label={`診断 ${step + 1}/${questions.length}`}><span style={{ width: `${Math.max(6, progress)}%` }} /></div><p className="eyebrow">QUESTION {step + 1} / {questions.length}</p><h2>{question.title}</h2><div className="option-list">{question.options.map(([label,value]) => <button type="button" key={value} onClick={() => answer(value)}>{label}</button>)}</div>{step > 0 && <button type="button" className="secondary" onClick={() => { setAnswers((current) => current.slice(0,-1)); setStep((current) => current - 1); }}>ひとつ戻る</button>}</div>;
}

function createResult(answers: string[]): DiagnosisResult {
  const has = (value: string) => answers.includes(value);
  const restricted = has("restricted") || has("office");
  const shape: NailShape = has("almond") ? "almond" : has("square") ? "squoval" : has("oval") ? "oval" : "round";
  const length: DiagnosisResult["length"] = restricted || has("short") ? "short" : has("long") && !restricted ? "long" : "medium";
  const color = has("dark") ? "#6f3442" : has("cool") || has("cool-tone") ? "#b78ca8" : has("warm") || has("warm-tone") ? "#c78f7f" : "#d88fa3";
  const pattern: NailPattern = restricted || has("soft") ? "gradient" : has("bold") || has("event") ? "patterned" : "french";
  const title = restricted ? "上品シンプル × 肌なじみカラー" : has("mode") || has("dark") ? "モード × 奥行きカラー" : has("cute") || has("pink") ? "やわらかフェミニン × ピンク" : "洗練ナチュラル × ニュアンス";
  return { title, description: "好みと使う場面を合わせると、無理なく楽しめるこの方向がおすすめです。色は照明で見え方が変わるため、試着画面で明るさの違う候補も比べてみてください。", shape, color, length, pattern, tags: [shapeLabel(shape), length === "short" ? "Short" : length === "long" ? "Long" : "Medium", pattern === "gradient" ? "Gradation" : pattern === "french" ? "French" : "Art"], completedAt: new Date().toISOString() };
}

function shapeLabel(shape: NailShape) { return ({ round:"Round",oval:"Oval",squoval:"Squoval",almond:"Almond",coffin:"Ballerina",square:"Square",stiletto:"Stiletto",natural:"Natural" })[shape]; }
