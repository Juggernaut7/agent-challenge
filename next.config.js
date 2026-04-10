/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverExternalPackages: [
      '@langchain/langgraph',
      '@langchain/langgraph-checkpoint-redis',
      'redis',
      '@redis/client',
      '@e2b/code-interpreter',
      'e2b',
    ],
  },
}

module.exports = nextConfig