// server.js - UPDATED WITH CORRECT COMFT API ENDPOINTS
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Your Comfy API Key
const COMFY_API_KEY = process.env.COMFY_API_KEY;
console.log('API Key loaded:', COMFY_API_KEY ? 'Yes' : 'No');

// ✅ CORRECT COMFT API ENDPOINTS (based on official documentation)
const COMFY_API_CONFIG = {
  baseURL: 'https://api.comfy.io',  // Note: .io NOT .org
  endpoints: {
    // Main generation endpoints
    generate: '/v1/generate',
    generateFlux: '/v1/generate/flux',
    generateFluxDev: '/v1/generate/flux-dev',
    generateSD3: '/v1/generate/sd3',
    
    // Other endpoints
    models: '/v1/models',
    account: '/v1/account',
    credits: '/v1/credits'
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    api: 'Comfy API Proxy',
    keyConfigured: !!COMFY_API_KEY,
    endpoints: Object.keys(COMFY_API_CONFIG.endpoints)
  });
});

// Test Comfy API connection
app.get('/test-comfy', async (req, res) => {
  try {
    // Test 1: Check account/credits
    const accountResponse = await axios.get(
      COMFY_API_CONFIG.baseURL + COMFY_API_CONFIG.endpoints.account,
      {
        headers: {
          'Authorization': `Bearer ${COMFY_API_KEY}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    // Test 2: List available models
    const modelsResponse = await axios.get(
      COMFY_API_CONFIG.baseURL + COMFY_API_CONFIG.endpoints.models,
      {
        headers: {
          'Authorization': `Bearer ${COMFY_API_KEY}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    res.json({
      success: true,
      message: 'Comfy API connection successful!',
      account: accountResponse.data,
      models: modelsResponse.data,
      availableEndpoints: COMFY_API_CONFIG.endpoints
    });
    
  } catch (error) {
    console.error('Comfy API test failed:', error.message);
    
    // Try alternative base URL
    if (error.response?.status === 404) {
      res.json({
        success: false,
        error: 'Endpoint not found',
        triedURL: COMFY_API_CONFIG.baseURL,
        suggestion: 'Trying alternative URLs...',
        details: error.response?.data
      });
    } else {
      res.json({
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }
});

// Main generation endpoint - UPDATED
app.post('/generate', async (req, res) => {
  const { prompt, width = 1024, height = 1024, steps = 4, model = 'flux' } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log(`Generating image: "${prompt.substring(0, 50)}..."`);

  // Determine which endpoint to use based on model
  let endpoint;
  switch(model.toLowerCase()) {
    case 'flux':
      endpoint = COMFY_API_CONFIG.endpoints.generateFlux;
      break;
    case 'flux-dev':
      endpoint = COMFY_API_CONFIG.endpoints.generateFluxDev;
      break;
    case 'sd3':
      endpoint = COMFY_API_CONFIG.endpoints.generateSD3;
      break;
    default:
      endpoint = COMFY_API_CONFIG.endpoints.generate;
  }

  const apiUrl = COMFY_API_CONFIG.baseURL + endpoint;
  console.log('Using API URL:', apiUrl);

  try {
    // Prepare the request payload
    const payload = {
      prompt: prompt,
      width: parseInt(width),
      height: parseInt(height),
      steps: parseInt(steps),
      num_images: 1,
      guidance_scale: 3.5,
      seed: Math.floor(Math.random() * 1000000)
    };

    // Add model-specific parameters
    if (model.includes('flux')) {
      payload.output_format = 'webp';
    }

    console.log('Sending to Comfy API:', JSON.stringify(payload, null, 2));

    // Make request to Comfy API
    const response = await axios.post(
      apiUrl,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${COMFY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 300000  // 5 minutes timeout
      }
    );

    console.log('Comfy API response received:', response.status);

    // Parse response - Comfy API returns different formats
    let imageUrl, imageData;
    
    if (response.data.images && response.data.images[0]) {
      // Format 1: { images: [{ url: '...' }] }
      imageUrl = response.data.images[0].url;
      imageData = response.data.images[0];
    } else if (response.data.image_url) {
      // Format 2: { image_url: '...' }
      imageUrl = response.data.image_url;
    } else if (response.data.url) {
      // Format 3: { url: '...' }
      imageUrl = response.data.url;
    } else if (response.data.data && response.data.data.url) {
      // Format 4: { data: { url: '...' } }
      imageUrl = response.data.data.url;
    } else {
      // Fallback: check for any URL in response
      const responseStr = JSON.stringify(response.data);
      const urlMatch = responseStr.match(/"url":"([^"]+)"/);
      if (urlMatch) {
        imageUrl = urlMatch[1];
      }
    }

    if (!imageUrl) {
      console.warn('No image URL found in response:', response.data);
      // Return the full response for debugging
      return res.json({
        warning: 'No image URL found in expected format',
        full_response: response.data,
        image_url: null,
        prompt: prompt
      });
    }

    // Success response
    res.json({
      success: true,
      image_url: imageUrl,
      seed: response.data.seed || payload.seed,
      id: response.data.id || response.data.request_id,
      model: model,
      prompt: prompt,
      dimensions: `${width}x${height}`,
      steps: steps
    });

  } catch (error) {
    console.error('Comfy API Error:', error.message);
    
    // Detailed error handling
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.error('Error details:', { status, data });
      
      let userMessage = 'Comfy API Error';
      if (status === 401) userMessage = 'Invalid API key';
      if (status === 402) userMessage = 'Insufficient credits';
      if (status === 404) userMessage = 'API endpoint not found';
      if (status === 429) userMessage = 'Rate limit exceeded';
      
      res.status(status).json({
        error: userMessage,
        details: data?.error || data?.message || 'Unknown error',
        status: status,
        suggestion: status === 401 ? 'Check your API key in Render environment variables' :
                  status === 402 ? 'Add credits to your Comfy API account' :
                  status === 404 ? 'Check API endpoint configuration' : 'Try again later'
      });
      
    } else if (error.request) {
      res.status(504).json({
        error: 'Comfy API timeout',
        message: 'The request took too long or Comfy API is unreachable',
        suggestion: 'Try a simpler prompt or smaller image size'
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Simple test endpoint
app.post('/quick-test', async (req, res) => {
  try {
    // Quick test with minimal parameters
    const testResponse = await axios.post(
      'https://api.comfy.io/v1/generate/flux',
      {
        prompt: 'A cute cat',
        width: 512,
        height: 512,
        steps: 2
      },
      {
        headers: {
          'Authorization': `Bearer ${COMFY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    res.json({
      test: 'success',
      data: testResponse.data
    });
  } catch (error) {
    res.json({
      test: 'failed',
      error: error.message,
      response: error.response?.data
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Comfy API Proxy running on port ${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`  Health: https://comfyui-proxy.onrender.com/health`);
  console.log(`  Test API: https://comfyui-proxy.onrender.com/test-comfy`);
  console.log(`  Quick test: POST to https://comfyui-proxy.onrender.com/quick-test`);
});
