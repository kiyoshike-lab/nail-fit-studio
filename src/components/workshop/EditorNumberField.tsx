"use client";
import { useEffect, useId, useRef, useState } from "react";
import { parseEditorNumber } from "@/lib/editorNumber";

type Props = { label: string; value: number; min: number; max: number; onCommit: (value: number) => void };

// A number is one history action on blur/Enter, not an action for each keystroke.
// Keep the DOM input while external pointer edits update its displayed value.
export function EditorNumberField({ label, value, min, max, onCommit }: Props) {
  const input = useRef<HTMLInputElement>(null), id = useId();
  const [error, setError] = useState("");
  useEffect(() => {
    if (input.current && document.activeElement !== input.current) input.current.value = String(value);
  }, [value]);
  return <label className="editor-number-field">{label}
    <input ref={input} type="number" step="any" min={min} max={max} defaultValue={value}
      aria-invalid={!!error} aria-describedby={error ? id : undefined}
      onInput={() => { if (error) setError(""); }}
      onBlur={event => {
        const next = parseEditorNumber(event.currentTarget.value, min, max);
        if (next === null) {
          event.currentTarget.value = String(value);
          setError(`${min}〜${max}の数値を入力してください。元の値を保持しています。`);
          return;
        }
        setError("");
        if (next !== value) onCommit(next);
      }}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); event.currentTarget.value = String(value); setError(""); }
      }} />
    {error && <span id={id} className="field-error" role="alert">{error}</span>}
  </label>;
}
