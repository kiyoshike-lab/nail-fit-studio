import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/mediapipe/hand_landmarker.task",
          destination: "/model-assets/hand-landmarker",
          // Leave the public identity representation available to other clients.
          has: [{ type: "header", key: "accept-encoding", value: "(?:^|.*,\\s*)gzip(?:\\s*,.*|$)" }],
        },
      ],
    };
  },
};

export default nextConfig;
