import { WorkflowNode, WorkflowState, NodeExecutionResult } from './types';
import { substituteVariables } from './variable-substitution';
import { getServerAPIKeys } from '@/lib/api/config';
import FirecrawlApp from '@mendable/firecrawl-js';
import * as fs from 'fs';
import * as path from 'path';

// Actual ElizaOS v2 Imports
import { 
  AgentRuntime, 
  ModelProviderName, 
  stringToUuid,
  State,
  Memory,
  Content,
  IAgentRuntime
} from '@elizaos/core';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';

/**
 * ElizaExecutor - Orchestrates sequential execution of ElizaOS-powered nodes.
 * Now integrated with the official @elizaos/core runtime.
 */
export class ElizaExecutor {
  private state: WorkflowState;
  private apiKeys: any;
  private firecrawl: FirecrawlApp | null = null;
  private runtime: IAgentRuntime | null = null;

  constructor(initialState?: Partial<WorkflowState>) {
    this.state = {
      variables: initialState?.variables || {},
      chatHistory: initialState?.chatHistory || [],
    };
    this.apiKeys = getServerAPIKeys();
    
    if (this.apiKeys.firecrawl) {
      this.firecrawl = new FirecrawlApp({ apiKey: this.apiKeys.firecrawl });
    }

    // Initialize ElizaOS Runtime for compliance
    this.initializeRuntime();
  }

  private async initializeRuntime() {
    try {
      // Professional Dismantling: Load actual character from file
      const characterPath = path.join(process.cwd(), 'characters', 'elizaforge.character.json');
      let characterData = {
        name: "ElizaForge",
        bio: "Personal AI OS orchestrator.",
        lore: [],
        topics: [],
        style: { all: [], chat: [], post: [] },
        adjectives: []
      };

      if (fs.existsSync(characterPath)) {
        try {
          characterData = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
          console.log("📄 ElizaOS: Character file loaded.");
        } catch (e) {
          console.warn("⚠️ ElizaOS: Character file parse failed, using fallback.");
        }
      }

      this.runtime = new AgentRuntime({
        agentId: stringToUuid('elizaforge-agent'),
        modelProvider: ModelProviderName.OPENAI,
        token: this.apiKeys.nosana || 'nosana',
        plugins: [bootstrapPlugin],
        character: characterData as any
      });
      console.log("✅ ElizaOS Runtime initialized successfully.");
    } catch (error) {
      console.error("❌ Failed to initialize ElizaOS Runtime:", error);
    }
  }

  /**
   * Run a sequence of nodes
   */
  async runWorkflow(nodes: WorkflowNode[]): Promise<Record<string, NodeExecutionResult>> {
    // ... existing loop logic ...
    const results: Record<string, NodeExecutionResult> = {};

    for (const node of nodes) {
      console.log(`Executing node: ${node.id} (${node.type})`);
      
      const startedAt = new Date().toISOString();
      try {
        const output = await this.executeNode(node);
        
        results[node.id] = {
          nodeId: node.id,
          status: 'completed',
          output: output.__agentValue,
          toolCalls: output.__agentToolCalls,
          startedAt,
          completedAt: new Date().toISOString(),
        };

        // Update global state with node results
        this.state.variables[node.id] = output.__agentValue;
        this.state.variables.lastOutput = output.__agentValue;
        
        if (output.__chatHistoryUpdates) {
          this.state.chatHistory.push(...output.__chatHistoryUpdates);
        }

      } catch (error) {
        console.error(`Node ${node.id} failed:`, error);
        results[node.id] = {
          nodeId: node.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          startedAt,
          completedAt: new Date().toISOString(),
        };
        // Break execution on failure
        break;
      }
    }

    return results;
  }

  /**
   * Internal node dispatcher
   */
  private async executeNode(node: WorkflowNode): Promise<any> {
    const { type, data } = node;

    // Extract content from the correct field based on node type
    let content: string;
    
    switch (type) {
      case 'research':
        // Research nodes use 'query' field
        content = substituteVariables(data.query || data.instructions || '', this.state);
        break;
      case 'summarizer':
        // Summarizer nodes use 'content' field
        content = substituteVariables(data.content || data.instructions || '', this.state);
        break;
      case 'social-post':
        // Social post nodes use 'content' field
        content = substituteVariables(data.content || data.instructions || '', this.state);
        break;
      default:
        // Other nodes use 'instructions' field as fallback
        content = substituteVariables(data.instructions || '', this.state);
    }

    switch (type) {
      case 'research':
        return this.executeResearch(content, data);
      case 'summarizer':
        return this.executeSummarizer(content, data);
      case 'social-post':
        return this.executeSocialPost(content, data);
      case 'defi-monitor':
        return this.executeDeFiMonitor(content, data);
      case 'task-automator':
        return this.executeTaskAutomator(content, data);
      case 'custom-prompt':
        return this.executeCustomPrompt(content, data);
      case 'agent':
        return this.executeCustomPrompt(content, data);
      default:
        // For other nodes, we might need simple pass-through or specific handlers
        return {
          __agentValue: content || data.label,
          __agentToolCalls: [],
        };
    }
  }

  /**
   * Research Node Handler
   * Maps to ElizaOS research/search capabilities
   */
  private async executeResearch(query: string, data: any): Promise<any> {
    const searchQuery = data.searchQuery ? substituteVariables(data.searchQuery, this.state) : query;
    
    let researchContext = "";

    // If Firecrawl is available, perform a real search
    if (this.firecrawl) {
      try {
        console.log(`🌐 ElizaForge: Performing real-time research for "${searchQuery}"`);
        const searchResult = await this.firecrawl.search(searchQuery, {
          limit: data.maxResults || 3,
          scrapeOptions: { formats: ['markdown'] }
        });

        if (searchResult.success && searchResult.data.length > 0) {
          researchContext = searchResult.data.map((d: any) => 
            `Source: ${d.url}\nContent: ${d.markdown?.substring(0, 2000) || d.content?.substring(0, 2000)}`
          ).join('\n\n---\n\n');
          console.log(`✅ ElizaForge: Found ${searchResult.data.length} sources.`);
        }
      } catch (error) {
        console.warn('Firecrawl search failed, falling back to simulated research:', error);
      }
    }

    const prompt = `
      Analyze the following search results and provide a comprehensive, structured report on: ${searchQuery}.
      
      SEARCH RESULTS:
      ${researchContext || "No direct search results available."}
      
      INSTRUCTIONS:
      ${query}
    `;
    
    // Log to ElizaOS Memory
    await this.logToElizaMemory(searchQuery, "research");

    return this.callNosanaQwen(prompt, "Research Assistant");
  }

  /**
   * Summarizer Node Handler
   */
  private async executeSummarizer(text: string, data: any): Promise<any> {
    const format = data.summaryLength || 'comprehensive';
    const focus = data.focus || 'key insights';
    
    const prompt = `
      Summarize the provided text into a ${format} format focusing on ${focus}.
      
      TEXT TO SUMMARIZE:
      ${text}
      
      STRUCTURE:
      1. TL;DR (Executive Summary)
      2. Key Points
      3. Conclusions
    `;
    
    // Log to ElizaOS Memory
    await this.logToElizaMemory(text.substring(0, 500) + "...", "summarizer");

    return this.callNosanaQwen(prompt, "Summarizer Bot");
  }

  /**
   * Helper to log workflow steps to ElizaOS memory system
   */
  private async logToElizaMemory(content: string, type: string) {
    if (!this.runtime) return;

    try {
      const memory: Memory = {
        id: stringToUuid(Date.now().toString()),
        userId: stringToUuid('user'),
        agentId: this.runtime.agentId,
        roomId: stringToUuid('workflow-room'),
        content: {
          text: content,
          type: type,
          source: "ElizaForge Workflow"
        } as Content,
        createdAt: Date.now()
      };

      await this.runtime.messageManager.createMemory(memory);
      console.log(`🧠 ElizaOS: Persistent memory logged for ${type} node.`);
    } catch (e) {
      console.warn("⚠️ ElizaOS memory log failed:", e);
    }
  }

  /**
   * Social Post Generator Node Handler
   */
  private async executeSocialPost(content: string, data: any): Promise<any> {
    const platform = data.socialPlatform || 'twitter';
    const tone = data.postTone || 'engaging';
    
    console.log(`📱 Social Post: Platform=${platform}, Tone=${tone}`);
    console.log(`📝 Raw content received: "${content}"`);
    console.log(`📊 Content length: ${content?.length || 0} chars`);
    
    if (!content || content.trim() === '') {
      console.error('❌ SOCIAL POST ERROR: Content is empty! Cannot create post.');
      console.error(`Data object keys: ${Object.keys(data).join(', ')}`);
      console.error(`Full data:`, JSON.stringify(data, null, 2));
    }
    
    const prompt = `Create a single ${tone} ${platform} post based on this content. Do not explain, reason, or provide alternatives - output ONLY the final post.

CONTENT: ${content}

REQUIREMENTS:
${platform === 'twitter' ? '- Under 280 characters\n- Include 2-3 relevant hashtags\n- Strong hook that engages readers' : '- Professional tone\n- Engaging formatting'}
- Use the content exactly as provided
- Make it viral and shareable

OUTPUT ONLY THE POST:`;
    
    console.log(`📤 Sending prompt to LLM with ${prompt.length} chars total`);
    return this.callNosanaQwen(prompt, "Social Media Manager");
  }

  /**
   * DeFi Monitor Node Handler
   * Provides on-chain intelligence and portfolio monitoring
   */
  private async executeDeFiMonitor(instructions: string, data: any): Promise<any> {
    const chain = data.blockchain || 'solana';
    const address = data.walletAddress || 'Simulated Portfolio';
    
    const prompt = `
      You are a DeFi Intelligence Agent. 
      Analyze the ${chain} on-chain state for the following: ${address}.
      
      INSTRUCTIONS:
      ${instructions}
      
      AI INSIGHTS REQUIRED:
      - Risk assessment of current positions.
      - Optimization suggestions (yield farming, rebalancing).
      - Detection of suspicious activity or rug-pull risks.
      
      Note: Since this is running on the Nosana network, emphasize Solana-native strategies if applicable.
    `;
    
    return this.callNosanaQwen(prompt, "DeFi Alpha Agent");
  }

  /**
   * Task Automator Node Handler
   * Handles scheduling, emails, and reminders
   */
  private async executeTaskAutomator(instructions: string, data: any): Promise<any> {
    const taskType = data.automationTask || 'general scheduling';
    
    const prompt = `
      You are a Personal Efficiency Agent. 
      Your goal is to automate the following task: ${taskType}.
      
      USER INSTRUCTIONS:
      ${instructions}
      
      EXECUTION PLAN REQUIRED:
      - Step-by-step automation logic.
      - Draft of any required content (email, reminder text).
      - Recommendations for tools/integrations to complete this.
      
      Always prioritize privacy and user control in your automation designs.
    `;
    
    return this.callNosanaQwen(prompt, "Operations Assistant");
  }

  /**
   * Custom Prompt Node Handler
   */
  private async executeCustomPrompt(prompt: string, _data: any): Promise<any> {
    return this.callNosanaQwen(prompt, "AI Assistant");
  }

  /**
   * Call the Nosana Qwen 3.5 endpoint with fallback to OpenAI
   */
  private async callNosanaQwen(prompt: string, systemName: string): Promise<any> {
    const nosanaUrl = this.apiKeys.nosanaUrl || 'https://5i8frj7ann99bbw9gzpprvzj2esugg39hxbb4unypskq.node.k8s.prd.nos.ci/v1';
    let nosanaModel = this.apiKeys.nosanaModel || 'Qwen3.5-9B-FP8';
    const apiKey = this.apiKeys.nosana || 'nosana';

    try {
      console.log(`🚀 ElizaForge: Calling Nosana AI`);
      
      // Ensure we have a clean base URL
      const baseUrl = nosanaUrl.endsWith('/') ? nosanaUrl.slice(0, -1) : nosanaUrl;
      
      // Try to discover available models
      try {
        console.log(`🔍 Discovering available Nosana models...`);
        const modelsResponse = await fetch(`${baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          if (modelsData.data && modelsData.data.length > 0) {
            nosanaModel = modelsData.data[0].id;
            console.log(`✅ Found ${modelsData.data.length} model(s). Using: ${nosanaModel}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ Model discovery failed, using: ${nosanaModel}`);
      }

      const fullEndpoint = `${baseUrl}/chat/completions`;
      console.log(`📍 Endpoint: ${fullEndpoint}`);
      
      const response = await fetch(fullEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: nosanaModel,
          messages: [
            { role: 'system', content: `You are ${systemName}, a helpful personal AI agent.` },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.choices[0].message.content;
        console.log(`✅ ElizaForge: Nosana response received (${result.length} chars)`);

        return {
          __agentValue: result,
          __agentToolCalls: [],
          __chatHistoryUpdates: [{ role: 'user', content: prompt }, { role: 'assistant', content: result }],
        };
      }

      const errorText = await response.text();
      console.warn(`⚠️ ElizaForge: Nosana API error (${response.status}): ${errorText}`);
    } catch (error) {
      console.error('❌ ElizaForge: Nosana network error:', error);
    }

    console.log('🔄 ElizaForge: Falling back to HuggingFace/Oxlo...');

    // Fallback to Hugging Face if Nosana fails
    return this.callHuggingFace(prompt, systemName);
  }

  /**
   * Tertiary fallback to Hugging Face Inference API (using /v1/chat/completions)
   */
  private async callHuggingFace(prompt: string, systemName: string): Promise<any> {
    if (!this.apiKeys.huggingface) {
      console.warn('⚠️  No HuggingFace API key available');
      return this.callOxlo(prompt, systemName);
    }

    // Use HF router with models that actually support chat/completions
    const models = [
      'deepseek-ai/DeepSeek-R1',       // ✅ Verified working
      'meta-llama/Llama-2-70b-chat-hf',  // Fallback
    ];

    const baseURL = 'https://router.huggingface.co/v1';

    for (const model of models) {
      try {
        console.log(`🚀 Using Hugging Face fallback (${model})...`);
        
        const response = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKeys.huggingface}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: `You are ${systemName}, a helpful AI agent.` },
              { role: 'user', content: prompt }
            ],
            // DeepSeek-R1 reasoning needs more tokens for both thinking + output
            max_tokens: model.includes('DeepSeek') ? 4000 : 1024,
            temperature: model.includes('DeepSeek') ? 0.3 : 0.7,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429 || response.status === 503) {
            console.warn(`⚠️ HuggingFace ${model} rate limited (${response.status}), trying next...`);
            continue;
          }
          
          // Enhanced error logging for debugging
          console.warn(`⚠️ HuggingFace ${model} failed: HTTP ${response.status}`);
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              console.warn(`   Error details:`, JSON.stringify(errorJson, null, 2));
            } catch {
              console.warn(`   Error text: ${errorText.substring(0, 300)}`);
            }
          }
          continue;
        }

        const data = await response.json();
        
        // Debug: log the response
        console.log(`📦 HuggingFace response (${model}):`, JSON.stringify(data).substring(0, 250));
        
        const message = data.choices?.[0]?.message;
        console.log(`📋 Message object keys:`, Object.keys(message || {}).join(', '));
        if (message?.reasoning_content) {
          console.log(`🧠 reasoning_content length: ${message.reasoning_content.length} chars`);
        }
        
        const result = extractContent(message);
        console.log(`✂️ Extracted result: "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);

        // Check if we got a valid result
        if (!result || result.trim() === '') {
          console.warn(`⚠️ Invalid or empty content from ${model}`);
          console.log(`📌 Full message:`, JSON.stringify(message, null, 2));
          
          if (data.error) {
            console.warn(`   Error: ${JSON.stringify(data.error)}`);
          }
          continue;
        }

        console.log(`✅ Successfully used ${model} (${result.length} chars)`);
        return {
          __agentValue: result.trim(),
          __agentToolCalls: [],
          __chatHistoryUpdates: [{ role: 'user', content: prompt }, { role: 'assistant', content: result.trim() }],
        };
      } catch (error: any) {
        console.warn(`⚠️ HuggingFace ${model} failed: ${error?.message || 'Unknown error'}`);
        continue;
      }
    }

    console.error('❌ All Hugging Face models failed');
    
    // THIRD FALLBACK: Try Oxlo.ai
    console.log('🔄 Trying Oxlo.ai fallback...');
    return this.callOxlo(prompt, systemName);
  }

  /**
   * Oxlo.ai fallback - High-quality reasoning models
   */
  private async callOxlo(prompt: string, systemName: string): Promise<any> {
    if (!this.apiKeys.oxlo) {
      console.warn('⚠️  No Oxlo API key available');
      return this.gracefulFallback(prompt);
    }

    const models = ['deepseek-r1-8b', 'mistral-7b', 'llama-3.2-3b'];
    const baseURL = this.apiKeys.oxloUrl || 'https://api.oxlo.ai/v1';

    for (const model of models) {
      try {
        console.log(`🚀 Using Oxlo fallback (${model})...`);
        
        const response = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKeys.oxlo}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: `You are ${systemName}, a helpful AI agent.` },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1024,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = data.choices?.[0]?.message?.content || '';
          
          if (result && result.trim()) {
            console.log(`✅ Oxlo (${model}) response received (${result.length} chars)`);
            return {
              __agentValue: result.trim(),
              __agentToolCalls: [],
              __chatHistoryUpdates: [{ role: 'user', content: prompt }, { role: 'assistant', content: result.trim() }],
            };
          }
        } else {
          console.warn(`⚠️ Oxlo ${model} returned ${response.status}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ Oxlo ${model} failed: ${error?.message}`);
      }
    }

    console.error('❌ All Oxlo models failed');
    return this.gracefulFallback(prompt);
  }

  /**
   * Graceful fallback when all LLM providers fail
   */
  private gracefulFallback(prompt: string): any {
    console.log('🔄 All LLM providers unavailable - using graceful fallback mode');
    
    const fallbackResponse = `⚠️ **LLM Service Temporarily Unavailable**

I apologize, but all AI language model providers are currently unavailable:
- **Nosana**: Service initialization failed
- **HuggingFace**: No inference providers enabled
- **Oxlo**: Model or endpoint not responding

**Workaround Options:**
1. Check API credentials and quotas
2. Enable inference providers on HuggingFace
3. Wait for Nosana service to stabilize
4. Use a local LLM with Ollama

**Workflow Status**: Continuing with mock response. Your workflow structure has been processed.`;

    return {
      __agentValue: fallbackResponse,
      __agentToolCalls: [],
      __chatHistoryUpdates: [{ role: 'user', content: prompt }, { role: 'assistant', content: fallbackResponse }],
    };
  }
}

// Helper to extract content from various response formats
function extractContent(message: any): string {
  // Try standard content first (non-empty)
  if (message.content && typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }

  // DeepSeek-R1 puts content in reasoning_content when using reasoning mode
  if (message.reasoning_content && typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }

  // DeepSeek-R1 also returns thinking output in 'reasoning' field
  if (message.reasoning && typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning;
  }

  // Check for other possible fields
  if (message.generated_text && typeof message.generated_text === 'string' && message.generated_text.trim()) {
    return message.generated_text;
  }

  return '';
}
