import type { SourceMode } from "./types";

export type PreviewPresentation = { mode: SourceMode; expanded: boolean };

// A new source mode gets its own default. Ordinary recognition/editor updates
// keep the same object, so a user's choice is not overwritten on every frame.
export function previewPresentation(state: PreviewPresentation | undefined, mode: SourceMode): PreviewPresentation {
  return state?.mode === mode ? state : { mode, expanded: mode === "camera" };
}
