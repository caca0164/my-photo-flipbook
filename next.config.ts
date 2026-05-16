import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Album uploads go through Server Actions; default 1 MB is too small for photos.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
