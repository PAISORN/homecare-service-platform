import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  transpilePackages: [
    '@homecare/database-types',
    '@homecare/design-tokens',
    '@homecare/domain',
  ],
  typedRoutes: true,
};

export default nextConfig;
