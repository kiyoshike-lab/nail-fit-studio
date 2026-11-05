export type AnalyticsEvent =
  | "tryon_started"
  | "photo_uploaded"
  | "nail_design_selected"
  | "tryon_saved"
  | "tryon_shared"
  | "diagnosis_started"
  | "diagnosis_completed"
  | "favorite_added"
  | "guide_read"
  | "guide_to_tryon"
  | "design_editor_started" | "custom_design_saved" | "custom_design_tryon" | "nail_part_added" | "saved_design_reedited";

export function trackEvent(name: AnalyticsEvent, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as typeof window & {
    gtag?: (command: "event", eventName: string, values?: Record<string, string | number | boolean>) => void;
  };
  analyticsWindow.gtag?.("event", name, params);
}
