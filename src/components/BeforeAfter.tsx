"use client";

import { useEffect, useRef } from "react";

type Props = {
  enabled: boolean;
  onToggle: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
};

export function BeforeAfter({ enabled, onToggle, onHoldStart, onHoldEnd }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holding = useRef(false);
  const suppressClick = useRef(false);
  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined; };
  const endHold = () => {
    clearTimer();
    if (holding.current) { holding.current = false; onHoldEnd?.(); }
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <section className="panel-card compact-card">
      <button
        type="button"
        className={enabled ? "toggle is-on" : "toggle"}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          onToggle();
        }}
        onPointerDown={(event) => {
          clearTimer();
          suppressClick.current = false;
          if (!event.isPrimary || event.button !== 0 || !enabled || !onHoldStart) return;
          timer.current = setTimeout(() => {
            holding.current = true;
            suppressClick.current = true;
            onHoldStart();
          }, 220);
        }}
        onPointerUp={endHold}
        onPointerCancel={() => { endHold(); suppressClick.current = false; }}
        onPointerLeave={() => { endHold(); suppressClick.current = false; }}
        onContextMenu={(event) => { if (holding.current) event.preventDefault(); }}
      >
        {enabled ? "ネイルあり / 長押しでBefore" : "Before表示中"}
      </button>
    </section>
  );
}
