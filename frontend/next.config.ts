import type { NextConfig } from "next";
import path from "path";
import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const config: NextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(__dirname, "src/styles")],
  },
  env: {
    // Base URL for the FastAPI backend
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }
};

const nextConfig = withPWA({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
})(config);

export default nextConfig;
