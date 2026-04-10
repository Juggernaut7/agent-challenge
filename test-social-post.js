#!/usr/bin/env node

/**
 * Test Script for Social Post Node with LLM Providers
 * Simulates the exact workflow that was failing
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

console.log('🔍 TESTING SOCIAL POST NODE EXECUTION');
console.log('═'.repeat(60));
console.log();

async function testSocialPostWithDeepSeek() {
  console.log('📱 Social Post Content: "Decentralized AI is the future of computing."');
  console.log('Platform: twitter');
  console.log('Tone: engaging');
  console.log();

  const prompt = `Create a single engaging twitter post based on this content. Do not explain, reason, or provide alternatives - output ONLY the final post.

CONTENT: Decentralized AI is the future of computing.

REQUIREMENTS:
- Under 280 characters
- Include 2-3 relevant hashtags
- Strong hook that engages readers
- Use the content exactly as provided
- Make it viral and shareable

OUTPUT ONLY THE POST:`;

  console.log('📤 Sending request to HuggingFace (DeepSeek-R1)...');
  console.log();

  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-ai/DeepSeek-R1',
      messages: [
        { role: 'system', content: 'You are Social Media Manager, a helpful AI agent.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  console.log(`✓ Response status: ${response.status} ${response.statusText}`);
  console.log();

  const data = await response.json();

  // Log structured response
  console.log('📝 Full Response:');
  console.log(JSON.stringify(data, null, 2));
  console.log();

  // Extract message
  const message = data.choices?.[0]?.message;
  if (!message) {
    console.error('❌ No message in response!');
    return;
  }

  console.log('📋 Message Object Keys:', Object.keys(message).join(', '));
  console.log();

  // Test extraction logic (same as in eliza-executor.ts)
  function extractContent(message) {
    if (message.content && typeof message.content === 'string' && message.content.trim()) {
      return message.content;
    }
    if (message.reasoning_content && typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
      return message.reasoning_content;
    }
    if (message.reasoning && typeof message.reasoning === 'string' && message.reasoning.trim()) {
      console.log('ℹ️  Using reasoning field (reasoning mode output)');
      return message.reasoning;
    }
    if (message.generated_text && typeof message.generated_text === 'string' && message.generated_text.trim()) {
      return message.generated_text;
    }
    return '';
  }

  const result = extractContent(message);

  console.log('✂️ Extraction Result:');
  console.log('─'.repeat(60));
  if (result) {
    console.log(result.substring(0, 500) + (result.length > 500 ? '...' : ''));
    console.log('─'.repeat(60));
    console.log(`✅ Total length: ${result.length} characters`);
    console.log();
    
    if (result.length < 300) {
      console.log('✅ Result is suitable for Twitter (< 280 chars with margin)');
    } else {
      console.log('⚠️  Result is longer than expected for Twitter');
    }
  } else {
    console.error('❌ Extraction produced empty result!');
  }
}

testSocialPostWithDeepSeek().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
