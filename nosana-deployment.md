# ElizaForge Deployment Guide (Nosana)

This guide helps you deploy **ElizaForge** to the Nosana GPU network.

## 1. Prerequisites
- [Nosana CLI](https://docs.nosana.io/cli/) installed.
- A wallet with $NOS tokens.
- Docker installed and configured.

## 2. API Keys Needed
Create a `.env.local` file in the root directory (or use your Nosana job secrets) with the following:

```bash
# Core AI (Nosana Qwen compatible)
NOSANA_QWEN_URL=https://api.nosana.io/v1/qwen
OPENAI_API_KEY=your_nosana_or_openai_key_here

# Optional: Research & Web Tools
TAVILY_API_KEY=your_tavily_key_here
FIRECRAWL_API_KEY=your_firecrawl_key_here

# Optional: Specialized Providers
ANTHROPIC_API_KEY=your_anthropic_key_here
```

## 3. Local Development (Checking the UI)
To check the UI locally on your machine:
1.  Open your terminal.
2.  Run: `npm run dev`
3.  Visit: [http://localhost:3000](http://localhost:3000)

## 4. Building the Container
Build your sanitized ElizaForge image for the decentralized network:

```bash
docker build -t your-username/elizaforge:latest .
docker push your-username/elizaforge:latest
```

## 5. Nosana Job Definition
Use the following `nosana_job.json` to deploy your container:

```json
{
  "ops": [
    {
      "op": "container/run",
      "id": "elizaforge-node",
      "args": {
        "image": "your-username/elizaforge:latest",
        "env": {
          "OPENAI_API_KEY": "AUTO_REPLACED_FROM_SECRETS",
          "NOSANA_QWEN_URL": "https://api.nosana.io/v1/qwen"
        },
        "resources": {
          "gpu": {
            "count": 1
          }
        }
      }
    }
  ]
}
```

## 6. Best Practices for Judging
- **Modularity**: Nodes are independent; you can add new plugins in `lib/workflow/eliza-executor.ts`.
- **Decentralization**: All execution is optimized for Nosana's GPU grid.
- **Agentic UX**: The "Personal AI OS" framing makes it a product, not just a tool.
- **Dockerized**: Fully ready for decentralized deployment out of the box.
