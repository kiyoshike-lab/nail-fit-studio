export type ContactConfiguration = { formId: string; siteKey: string; ready: boolean };

// Called only by server pages/handlers. Only ready/siteKey may be passed to UI.
export function contactConfiguration(env: Readonly<Record<string, string | undefined>>): ContactConfiguration {
  const formId = env.CONTACT_FORMSPREE_FORM_ID?.trim() ?? "";
  const siteKey = env.CONTACT_TURNSTILE_SITE_KEY?.trim() ?? "";
  const ready = /^[a-zA-Z0-9]{6,64}$/.test(formId)
    && /^[a-zA-Z0-9_-]{15,100}$/.test(siteKey)
    && env.CONTACT_FORMSPREE_TURNSTILE_ENABLED === "true"
    // Published Turnstile testing keys must never enable the deployed form.
    && !/^[123]x0+/.test(siteKey);
  return { formId, siteKey, ready };
}
