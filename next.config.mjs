/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  experimental: {
    nodeMiddleware: true,
  },
};

export default nextConfig;
