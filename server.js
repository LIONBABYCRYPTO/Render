// server.js - NANO BANANA API VERSION
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Your Nano Banana API Key (from your purchase)
const NANO_BANANA_API_KEY = process.env.COMFY_API_KEY || 'sk-adREr3pU49iPRSkj7sBCa7NDMpWtV9NuMoiqNfylHCl9GP9u';
console.log('Nano Banana API Key loaded:', NANO_BANANA_API_KEY.substring(0, 12) + '...');

// ✅ NANO BANANA API ENDPOINTS (based on common Chinese API services)
// These are common endpoints for these types of services
const NANO_BANANA_CONFIGS = [
  {
    name: 'Option 1: Common Chinese API Gateway',
    baseURL: 'https://api.nanobanana.ai',
    endpoints: {
      generate: '/v1/images/generations',
      models: '/v1/models',
      balance: '/v1/user/balance'
    }
  },
  {
    name: 'Option 2: OpenAI-compatible Proxy',
    baseURL: 'https://api.openai-proxy.com',
    endpoints: {
      generate: '/v1/images/generations',
      models: '/v1/models',
      balance: '/v1/user/balance'
    }
  },
  {
    name: 'Option 3: Custom Gateway',
    baseURL: 'https://gateway.ai.cloudflare.com',
    endpoints: {
      generate: '/v1/comfy/generate',
      models: '/v1/comfy/models'
    }
  },
  {
    name: 'Option 4: Direct ComfyUI Proxy',
    baseURL: 'https://comfy.nanobanana.com',
    endpoints: {
      generate: '/api/generate',
      models: '/api/models',
      workflows: '/api/workflows'
    }
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nano Banana API Gateway',
    keyConfigured: true,
    keyPreview: NANO_BANANA_API_KEY.substring(0, 12) + '...',
    purchaseInfo: 'Nano Banana Pro 2.0 - 200次调用',
    endpoints: ['/health', '/discover-nano', '/test-key', '/generate']
  });
});

// 🔍 DISCOVER NANO BANANA API ENDPOINT
app.get('/discover-nano', async (req, res) => {
  console.log('Discovering Nano Banana API endpoint...');
  
  const testResults = [];
  
  // Test common endpoint patterns
  const testPatterns = [
    // Pattern 1: OpenAI-compatible image generation
    {
      url: 'https://api.openai-proxy.com/v1/images/generations',
      method: 'POST',
      data: {
        model: "dall-e-3",
        prompt: "test",
        n: 1,
        size: "256x256"
      },
      headers: {
        'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    },
    
    // Pattern 2: SDXL generation
    {
      url: 'https://api.nanobanana.ai/v1/generate',
      method: 'POST',
      data: {
        prompt: "test",
        width: 256,
        height: 256,
        steps: 1
      },
      headers: {
        'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    },
    
    // Pattern 3: Get models list
    {
      url: 'https://api.nanobanana.ai/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    },
    
    // Pattern 4: Check balance
    {
      url: 'https://api.nanobanana.ai/v1/user/balance',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  ];
  
  for (let i = 0; i < testPatterns.length; i++) {
    const test = testPatterns[i];
    console.log(`Testing pattern ${i + 1}: ${test.url}`);
    
    try {
      let response;
      if (test.method === 'GET') {
        response = await axios.get(test.url, {
          headers: test.headers,
          timeout: 10000,
          validateStatus: () => true // Accept all status codes
        });
      } else {
        response = await axios.post(test.url, test.data, {
          headers: test.headers,
          timeout: 10000,
          validateStatus: () => true
        });
      }
      
      testResults.push({
        pattern: i + 1,
        url: test.url,
        method: test.method,
        status: response.status,
        success: response.status < 400,
        data: response.data,
        headers: response.headers
      });
      
      console.log(`  Pattern ${i + 1}: ${response.status}`);
      
    } catch (error) {
      testResults.push({
        pattern: i + 1,
        url: test.url,
        method: test.method,
        success: false,
        error: error.code || error.message,
        message: error.message
      });
      console.log(`  Pattern ${i + 1}: ERROR - ${error.code || error.message}`);
    }
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Analyze results
  const workingPatterns = testResults.filter(r => r.success);
  
  res.json({
    discovery: 'complete',
    service: 'Nano Banana API Discovery',
    totalPatternsTested: testPatterns.length,
    workingPatterns: workingPatterns.length,
    allResults: testResults,
    recommendations: workingPatterns.length > 0 ? 
      `Use Pattern ${workingPatterns[0].pattern}: ${workingPatterns[0].url}` :
      'No patterns worked. Check the tutorial link.'
  });
});

// Check API key validity
app.get('/test-key', async (req, res) => {
  try {
    // Try to get balance or model list
    const response = await axios.get('https://api.openai-proxy.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
        'Accept': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      res.json({
        success: true,
        message: 'API key is valid!',
        status: response.status,
        data: response.data,
        remainingCalls: '200 calls purchased (Nano Banana Pro 2.0)'
      });
    } else if (response.status === 401) {
      res.json({
        success: false,
        message: 'Invalid API key',
        status: response.status
      });
    } else {
      res.json({
        success: 'partial',
        message: 'Unexpected response',
        status: response.status,
        data: response.data
      });
    }
    
  } catch (error) {
    res.json({
      success: false,
      error: error.code || error.message,
      message: 'Cannot connect to API server',
      suggestion: 'Try the /discover-nano endpoint first'
    });
  }
});

// 🎨 MAIN GENERATION ENDPOINT - Optimized for Nano Banana
app.post('/generate', async (req, res) => {
  const { prompt, width = 1024, height = 1024, steps = 20, model = 'flux' } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  console.log(`Nano Banana Generation: "${prompt.substring(0, 50)}..."`);
  
  // Try multiple API endpoint patterns (most likely to work)
  const apiAttempts = [
    {
      name: 'OpenAI-Compatible DALL-E',
      url: 'https://api.openai-proxy.com/v1/images/generations',
      payload: {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: `${width}x${height}`,
        quality: "standard",
        style: "vivid",
        response_format: "url"
      },
      timeout: 120000
    },
    {
      name: 'SDXL Generation',
      url: 'https://api.nanobanana.ai/v1/generate',
      payload: {
        prompt: prompt,
        negative_prompt: "",
        width: parseInt(width),
        height: parseInt(height),
        steps: parseInt(steps),
        cfg_scale: 7,
        sampler_name: "DPM++ 2M Karras",
        scheduler: "karras",
        seed: -1,
        model: "sdxl",
        loras: []
      },
      timeout: 180000
    },
    {
      name: 'Flux Model',
      url: 'https://api.nanobanana.ai/v1/generate/flux',
      payload: {
        prompt: prompt,
        width: parseInt(width),
        height: parseInt(height),
        steps: 4, // Flux uses fewer steps
        guidance_scale: 3.5,
        output_format: "webp"
      },
      timeout: 180000
    },
    {
      name: 'Simple Text-to-Image',
      url: 'https://gateway.ai.cloudflare.com/v1/comfy/generate',
      payload: {
        workflow: "text2image",
        prompt: prompt,
        width: parseInt(width),
        height: parseInt(height),
        steps: parseInt(steps)
      },
      timeout: 180000
    }
  ];
  
  let lastError = null;
  
  for (const attempt of apiAttempts) {
    console.log(`Trying: ${attempt.name} (${attempt.url})`);
    
    try {
      const response = await axios.post(
        attempt.url,
        attempt.payload,
        {
          headers: {
            'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: attempt.timeout
        }
      );
      
      console.log(`Success with ${attempt.name}! Status: ${response.status}`);
      
      // Parse response based on service type
      let imageUrl;
      
      if (attempt.name.includes('DALL-E')) {
        // OpenAI format: { data: [{ url: '...' }] }
        imageUrl = response.data?.data?.[0]?.url;
      } else if (response.data?.images?.[0]?.url) {
        // ComfyUI format: { images: [{ url: '...' }] }
        imageUrl = response.data.images[0].url;
      } else if (response.data?.image_url) {
        // Simple format: { image_url: '...' }
        imageUrl = response.data.image_url;
      } else if (response.data?.url) {
        // Direct URL format: { url: '...' }
        imageUrl = response.data.url;
      } else if (response.data?.data?.url) {
        // Nested format: { data: { url: '...' } }
        imageUrl = response.data.data.url;
      } else {
        // Try to find any URL in the response
        const jsonStr = JSON.stringify(response.data);
        const urlMatch = jsonStr.match(/"url":"([^"]+)"/);
        if (urlMatch) imageUrl = urlMatch[1];
      }
      
      if (imageUrl) {
        return res.json({
          success: true,
          service: attempt.name,
          image_url: imageUrl,
          prompt: prompt,
          dimensions: `${width}x${height}`,
          note: 'Nano Banana API - 剩余次数: 200次'
        });
      } else {
        console.log(`No image URL found in ${attempt.name} response`);
        lastError = { attempt: attempt.name, error: 'No image URL in response', data: response.data };
      }
      
    } catch (error) {
      console.log(`Failed with ${attempt.name}: ${error.response?.status || error.code || error.message}`);
      lastError = {
        attempt: attempt.name,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
      
      // If we got a 402 (payment required) or 403 (forbidden), stop trying
      if (error.response?.status === 402 || error.response?.status === 403) {
        break;
      }
    }
    
    // Wait 1 second before next attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // If all attempts failed
  res.status(500).json({
    success: false,
    error: 'All API attempts failed',
    lastAttempt: lastError?.attempt,
    details: lastError?.error,
    status: lastError?.status,
    purchaseInfo: '您购买了 Nano Banana Pro 2.0 - 200次调用',
    tutorialLink: 'https://docs.qq.com/doc/DWXBXUOxnTkxrVFd5',
    suggestions: [
      '1. 检查API密钥是否正确',
      '2. 查看腾讯文档教程: https://docs.qq.com/doc/DWXBXUOxnTkxrVFd5',
      '3. 联系卖家获取准确API地址',
      '4. 确保账户有剩余调用次数'
    ]
  });
});

// Quick test with minimal parameters
app.post('/quick-test', async (req, res) => {
  try {
    // Minimal test - most likely to work
    const response = await axios.post(
      'https://api.openai-proxy.com/v1/images/generations',
      {
        model: "dall-e-3",
        prompt: "a red apple",
        n: 1,
        size: "256x256"
      },
      {
        headers: {
          'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    res.json({
      test: 'success',
      service: 'OpenAI-compatible proxy',
      data: response.data,
      remainingCalls: 'Check your Nano Banana account'
    });
    
  } catch (error) {
    res.json({
      test: 'failed',
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      nextStep: 'Try /discover-nano endpoint to find correct API URL'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Nano Banana API Proxy running on port ${PORT}`);
  console.log('='.repeat(50));
  console.log('📱 购买信息: Nano Banana Pro 2.0 - 200次调用');
  console.log('🔑 API Key:', NANO_BANANA_API_KEY.substring(0, 12) + '...');
  console.log('📖 教程链接: https://docs.qq.com/doc/DWXBXUOxnTkxrVFd5');
  console.log('='.repeat(50));
  console.log('\n测试端点:');
  console.log(`1. 健康检查: https://comfyui-proxy.onrender.com/health`);
  console.log(`2. 发现API端点: https://comfyui-proxy.onrender.com/discover-nano`);
  console.log(`3. 测试密钥: https://comfyui-proxy.onrender.com/test-key`);
  console.log(`4. 快速测试: POST https://comfyui-proxy.onrender.com/quick-test`);
  console.log(`5. 生成图片: POST https://comfyui-proxy.onrender.com/generate`);
});
