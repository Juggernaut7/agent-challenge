#!/usr/bin/env node

/**
 * LLM Provider Diagnostic Script
 * Tests Nosana, OpenAI, and HuggingFace endpoints directly
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const NOSANA_URL = process.env.NOSANA_QWEN_URL || 'https://5i8frj7ann99bbw9gzpprvzj2esugg39hxbb4unypskq.node.k8s.prd.nos.ci/v1';
const NOSANA_API_KEY = process.env.NOSANA_API_KEY || 'nosana';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const OXLO_API_KEY = 'sk_Wa-ZEr8Mh12eKiIVG3i7F_W8FSgwsPQh5b8NIWnjG4U';
const OXLO_URL = 'https://api.oxlo.ai/v1';

console.log('🔍 LLM PROVIDER DIAGNOSTIC SCRIPT');
console.log('═'.repeat(60));
console.log();

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ️${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

async function testNosana() {
  log.section('1️⃣  TESTING NOSANA ENDPOINT');
  console.log(`URL: ${NOSANA_URL}/chat/completions`);
  console.log(`API Key: ${NOSANA_API_KEY.substring(0, 10)}...`);

  // First, try to get available models
  let availableModel = 'Qwen/Qwen3.5-4B';
  try {
    console.log(`Checking available models at ${NOSANA_URL}/models...`);
    const modelsResponse = await fetch(`${NOSANA_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${NOSANA_API_KEY}`,
      },
    });
    
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      if (modelsData.data && modelsData.data.length > 0) {
        availableModel = modelsData.data[0].id;
        console.log(`✅ Found ${modelsData.data.length} models. Using: ${availableModel}`);
      }
    }
  } catch (e) {
    console.log(`⚠️ Could not fetch models list, trying default: ${availableModel}`);
  }

  try {
    const response = await fetch(`${NOSANA_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NOSANA_API_KEY}`,
      },
      body: JSON.stringify({
        model: availableModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello' }
        ],
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      log.success(`Nosana is working!`);
      console.log(`Response preview: ${JSON.stringify(data).substring(0, 100)}...`);
      return true;
    } else {
      const errorText = await response.text();
      log.error(`Nosana returned error ${response.status}`);
      if (response.status === 503) {
        log.warn(`Service is initializing (503)`);
      }
      console.log(`Error preview: ${errorText.substring(0, 200)}...`);
      return false;
    }
  } catch (error) {
    log.error(`Nosana connection failed: ${error.message}`);
    return false;
  }
}

async function testOpenAI() {
  log.section('3️⃣  TESTING OPENAI ENDPOINT');
  
  if (!OPENAI_API_KEY) {
    log.warn('No OPENAI_API_KEY found in .env.local');
    return false;
  }

  console.log(`API Key: ${OPENAI_API_KEY.substring(0, 20)}...`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello' }
        ],
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      log.success(`OpenAI is working!`);
      console.log(`Response preview: ${JSON.stringify(data).substring(0, 100)}...`);
      return true;
    } else {
      const errorData = await response.json();
      log.error(`OpenAI returned error ${response.status}`);
      
      if (response.status === 429) {
        log.error(`API QUOTA EXCEEDED - Cannot make requests until quota resets`);
        console.log(`Error: ${errorData.error?.message || JSON.stringify(errorData).substring(0, 200)}`);
      } else {
        console.log(`Error: ${JSON.stringify(errorData).substring(0, 200)}...`);
      }
      return false;
    }
  } catch (error) {
    log.error(`OpenAI connection failed: ${error.message}`);
    return false;
  }
}

async function testHuggingFace() {
  log.section('4️⃣  TESTING HUGGINGFACE ENDPOINT');
  
  if (!HUGGINGFACE_API_KEY) {
    log.warn('No HUGGINGFACE_API_KEY found in .env.local');
    return false;
  }

  // Try multiple models - use ones that are known to work on free tier
  const models = [
    'meta-llama/Llama-2-7b-chat-hf',  // Free tier
    'mistralai/Mistral-7B-Instruct-v0.2',  // Updated version
    'HuggingFaceH4/zephyr-7b-beta',  // Free tier alternative
    'tiiuae/falcon-7b-instruct',  // Another free option
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',  // Alternative
  ];

  const baseURL = 'https://router.huggingface.co/v1';
  console.log(`Base URL: ${baseURL}`);
  console.log(`API Key: ${HUGGINGFACE_API_KEY.substring(0, 20)}...`);
  console.log(`Trying models: ${models.join(', ')}`);
  console.log();

  for (const model of models) {
    try {
      console.log(`  Attempting model: ${model}...`);
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say hello in one sentence' }
          ],
          max_tokens: 50,
          temperature: 0.7,
        }),
      });

      console.log(`    Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        log.success(`HuggingFace is working with model: ${model}`);
        console.log(`    Response: ${JSON.stringify(data.choices?.[0]?.message?.content || data).substring(0, 80)}...`);
        return true;
      } else if (response.status === 429 || response.status === 503) {
        console.log(`    ${response.status === 429 ? 'Rate limited' : 'Service unavailable'} - trying next model...`);
        continue;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log(`    Error: ${errorData.error?.message || response.statusText}`);
        continue;
      }
    } catch (error) {
      console.log(`    Connection error: ${error.message}`);
      continue;
    }
  }

  log.error(`All HuggingFace models failed`);
  return false;
}

async function testOxlo() {
  log.section('4️⃣  TESTING OXLO.AI ENDPOINT');
  
  if (!OXLO_API_KEY) {
    log.warn('No OXLO_API_KEY found');
    return false;
  }

  // Try free-tier and accessible models from Oxlo
  const models = [
    'deepseek-r1-8b',
    'mistral-7b',
    'llama-3.2-3b',
    'deepseek-v3.2',
  ];

  console.log(`API Key: ${OXLO_API_KEY.substring(0, 20)}...`);
  console.log(`Base URL: ${OXLO_URL}`);
  console.log(`Trying models: ${models.join(', ')}`);
  console.log();

  for (const model of models) {
    try {
      console.log(`  Attempting model: ${model}...`);
      const response = await fetch(`${OXLO_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OXLO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say hello in one sentence' }
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      console.log(`    Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        log.success(`Oxlo is working with model: ${model}`);
        console.log(`    Response: ${JSON.stringify(data.choices?.[0]?.message?.content || data).substring(0, 80)}...`);
        return true;
      } else if (response.status === 429 || response.status === 503) {
        console.log(`    ${response.status === 429 ? 'Rate limited' : 'Service unavailable'} - trying next model...`);
        continue;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log(`    Error: ${errorData.error?.message || response.statusText}`);
        continue;
      }
    } catch (error) {
      console.log(`    Connection error: ${error.message}`);
      continue;
    }
  }

  log.error(`All Oxlo models failed`);
  return false;
}

async function runAllTests() {
  console.log(`Testing at: ${new Date().toISOString()}`);
  console.log();

  const nosanaWorking = await testNosana();
  const openaiWorking = await testOpenAI();
  const huggingfaceWorking = await testHuggingFace();
  const oxloWorking = await testOxlo();

  log.section('📊 SUMMARY');
  console.log();
  console.log(`Nosana............... ${nosanaWorking ? colors.green + '✅ Working' : colors.red + '❌ Failed'} ${colors.reset}`);
  console.log(`OpenAI............... ${openaiWorking ? colors.green + '✅ Working' : colors.red + '❌ Failed'} ${colors.reset}`);
  console.log(`HuggingFace.......... ${huggingfaceWorking ? colors.green + '✅ Working' : colors.red + '❌ Failed'} ${colors.reset}`);
  console.log(`Oxlo.ai.............. ${oxloWorking ? colors.green + '✅ Working' : colors.red + '❌ Failed'} ${colors.reset}`);
  console.log();

  const workingCount = [nosanaWorking, openaiWorking, huggingfaceWorking, oxloWorking].filter(Boolean).length;

  if (workingCount === 0) {
    log.error(`NO PROVIDERS WORKING - All services are unavailable!`);
    console.log();
    log.warn(`Possible issues:`);
    console.log(`  • Nosana: Service still initializing (503)`);
    console.log(`  • OpenAI: Quota exceeded or billing issue`);
    console.log(`  • HuggingFace: Endpoint gone or model removed`);
    console.log(`  • Oxlo: Model or endpoint not found`);
    process.exit(1);
  } else if (workingCount === 4) {
    log.success(`ALL PROVIDERS WORKING!`);
    console.log();
    console.log(`Your workflows should now run successfully.`);
    process.exit(0);
  } else {
    log.warn(`${workingCount} of 4 providers working`);
    console.log();
    console.log(`Workflows will use the first available provider.`);
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
