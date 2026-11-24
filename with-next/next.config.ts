import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dev server accepts requests from *.localhost, so a local test project
  // with a domain such as shop.localhost works (open http://shop.localhost:3000).
  allowedDevOrigins: ['*.localhost'],
};

export default nextConfig;
