import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false, // Disable strict mode to prevent double-mounting issues with Excalidraw
  transpilePackages: ['@excalidraw/excalidraw'],
};

export default nextConfig;
