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
  serverExternalPackages: [
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
  experimental: {},
}

module.exports = nextConfig