import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack instead of Turbopack for build to ensure Tailwind v3 utility classes compile correctly
  // See: https://nextjs.org/docs/app/api-reference/next-config-js/turbopack
  experimental: {
    // Disable Turbopack for build (keep dev as Turbopack for speed)
  },
  // Note: For Next.js 16, Turbopack is default for build. To use webpack, run:
  // npx next build --no-turbopack
  // But since the project may not have a webpack option, we'll keep current config
  // and adjust Tailwind content paths.
};

export default nextConfig;
