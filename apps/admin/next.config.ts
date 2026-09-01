import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@homecare/database-types',
    '@homecare/design-tokens',
    '@homecare/domain',
  ],
  typedRoutes: true,
};

export default nextConfig;
