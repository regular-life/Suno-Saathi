import type { NextConfig } from "next";
import path from "path";
import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const config: NextConfig = {
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(__dirname, "src/styles")],
  },
};

const nextConfig = withPWA({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
})(config);

export default nextConfig;
