/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@langchain/langgraph',
      '@langchain/langgraph-checkpoint-redis',
      'redis',
      '@redis/client',
      '@e2b/code-interpreter',
      'e2b',
      'sharp',
      '@elizaos/core',
      '@elizaos/plugin-bootstrap',
      '@elizaos/plugin-openai',
    ],
  },
}

module.exports = nextConfig