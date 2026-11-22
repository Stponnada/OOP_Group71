import type { NextConfig } from "next";
import path from "path";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // The app's version (see lib/version.ts), baked in at build time.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
