/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@tanstack/react-query"]
  }
};

export default nextConfig;
