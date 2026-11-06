// Report-only CSP is deliberately observational: AdSense's dynamic origins,
// Turnstile and real mobile WASM must be verified before enforcing a nonce CSP.
// No reporting endpoint is added, so browser reports cannot upload user data.
export const cspReportOnly=[
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.googlesyndication.com https://*.googletagmanager.com https://*.google.com https://*.gstatic.com https://*.doubleclick.net https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
  "connect-src 'self' https: blob:", "frame-src 'self' https:", "font-src 'self' data: https:",
  "worker-src 'self' blob:", "media-src 'self' blob:", "form-action 'self'",
].join("; ");
export const securityHeaders=[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"X-Frame-Options",value:"SAMEORIGIN"},
  {key:"Permissions-Policy",value:"camera=(self), microphone=(), geolocation=()"},
  {key:"Content-Security-Policy-Report-Only",value:cspReportOnly},
];
