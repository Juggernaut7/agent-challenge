# Final Production Image
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install minimal runtime libraries for graphics and AI
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libvips \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy essential runtime files created by the GitHub Action build
COPY public ./public
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output: 'standalone' produced by pnpm build on the runner
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY characters ./characters

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# server.js is the entrypoint for Next.js standalone builds
CMD ["node", "server.js"]
