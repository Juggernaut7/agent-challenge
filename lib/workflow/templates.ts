import { Workflow } from './types';

const templates: Record<string, Workflow> = {
  // =============================================================================
  // ElizaForge: Personal AI Assistant (Research)
  // =============================================================================
  'eliza-research-assistant': {
    id: 'eliza-research-assistant',
    name: 'AI Research Assistant',
    description: 'Autonomous research and summary agent. Enter a topic, and ElizaForge will find and distill the most relevant information.',
    category: 'ElizaForge Agents',
    tags: ['elizaos', 'research', 'summary', 'nosana'],
    difficulty: 'simple',
    estimatedTime: '1-2 minutes',
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 350 },
        data: {
          nodeType: 'start',
          label: 'Start',
          nodeName: 'Start',
          inputVariables: [
            {
              name: 'topic',
              type: 'string',
              required: true,
              description: 'What would you like me to research?',
              defaultValue: 'Quantum Computing'
            }
          ],
        },
      },
      {
        id: 'research',
        type: 'research',
        position: { x: 350, y: 350 },
        data: {
          nodeType: 'research',
          label: 'Deep Research',
          nodeName: 'Research Agent',
          query: '{{input.topic}}'
        },
      },
      {
        id: 'summarizer',
        type: 'summarizer',
        position: { x: 600, y: 350 },
        data: {
          nodeType: 'summarizer',
          label: 'Intelligent Summary',
          nodeName: 'Summarizer Agent',
          length: 'medium',
          content: '{{lastOutput}}'
        },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 850, y: 350 },
        data: {
          nodeType: 'end',
          label: 'End',
          nodeName: 'End',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'research' },
      { id: 'e2', source: 'research', target: 'summarizer' },
      { id: 'e3', source: 'summarizer', target: 'end' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // =============================================================================
  // ElizaForge: Social Content Generator
  // =============================================================================
  'eliza-social-manager': {
    id: 'eliza-social-manager',
    name: 'Social Media Manager',
    description: 'Transform any content or idea into high-performing social media posts.',
    category: 'ElizaForge Agents',
    tags: ['social', 'twitter', 'content', 'elizaos'],
    difficulty: 'simple',
    estimatedTime: '1 minute',
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 350 },
        data: {
          nodeType: 'start',
          label: 'Start',
          nodeName: 'Start',
          inputVariables: [
            {
              name: 'content',
              type: 'string',
              required: true,
              description: 'Paste the content or topic to post about',
              defaultValue: 'Decentralized AI is the future of computing.'
            }
          ],
        },
      },
      {
        id: 'social-post',
        type: 'social-post',
        position: { x: 400, y: 350 },
        data: {
          nodeType: 'social-post',
          label: 'Generate X Post',
          nodeName: 'Social Agent',
          platform: 'twitter',
          style: 'professional',
          content: '{{input.content}}'
        },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 700, y: 350 },
        data: {
          nodeType: 'end',
          label: 'End',
          nodeName: 'End',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'social-post' },
      { id: 'e2', source: 'social-post', target: 'end' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

export function getTemplate(templateId: string): Workflow | null {
  return templates[templateId] || null;
}

export function listTemplates(): Array<{
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  difficulty?: string;
  estimatedTime?: string;
}> {
  return Object.values(templates).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    tags: t.tags,
    difficulty: t.difficulty,
    estimatedTime: t.estimatedTime,
  }));
}
