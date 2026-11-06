import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./src/lib/securityHeaders";

const root = dirname(fileURLToPath(import.meta.url));
const gzipAcceptEncoding = [{ type: "header" as const, key: "accept-encoding", value: "(?:^|.*,\\s*)gzip(?:\\s*,.*|$)" }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
  async headers() { return [
    {source:"/:path*",headers:securityHeaders},
    // Next 16.4 strips Content-Encoding from prerendered Route Handler metadata.
    // These exact routes serve build-time gzip bytes, so declare transport here.
    {source:"/model-assets/hand-landmarker",headers:[{key:"Content-Encoding",value:"gzip"}]},
    {source:"/mediapipe/hand_landmarker.task",has:gzipAcceptEncoding,headers:[{key:"Content-Encoding",value:"gzip"}]},
  ]; },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/mediapipe/hand_landmarker.task",
          destination: "/model-assets/hand-landmarker",
          // Leave the public identity representation available to other clients.
          has: gzipAcceptEncoding,
        },
      ],
    };
  },
};

export default nextConfig;
