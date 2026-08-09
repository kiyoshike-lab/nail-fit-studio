"use client";

type Props = {
  enabled: boolean;
  onToggle: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
};

export function BeforeAfter({ enabled, onToggle, onHoldStart, onHoldEnd }: Props) {
  return (
    <section className="panel-card compact-card">
      <button
        type="button"
        className={enabled ? "toggle is-on" : "toggle"}
        onClick={onToggle}
        onPointerDown={onHoldStart}
        onPointerUp={onHoldEnd}
        onPointerCancel={onHoldEnd}
        onPointerLeave={onHoldEnd}
      >
        {enabled ? "ネイルあり / 長押しでBefore" : "Before表示中"}
      </button>
    </section>
  );
}
