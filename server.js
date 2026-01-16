// server.js - DEBUG VERSION
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Configuration - UPDATED ENDPOINTS
const COMFY_API_KEY = process.env.COMFY_API_KEY;
console.log('API Key loaded:', COMFY_API_KEY ? 'Yes (first 10 chars: ' + COMFY_API_KEY.substring(0, 10) + '...)' : 'NO KEY FOUND!');

// Try different Comfy API endpoints (test one at a time)
const COMFY_API_ENDPOINTS = {
  'flux': 'https://api.comfy.org/api/generate/flux',  // Most likely
  'flux-dev': 'https://api.comfy.org/api/generate/flux-dev',
  'api-v1': 'https://api.comfy.org/v1/generate',
  'api-v1-flux': 'https://api.comfy.org/v1/generate/flux',
  'test': 'https://api.comfy.org/api/models'  // Just to test connection
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasApiKey: !!COMFY_API_KEY,
    keyPreview: COMFY_API_KEY ? COMFY_API_KEY.substring(0, 8) + '...' : 'none'
  });
});

// Debug endpoint to test Comfy API directly
app.get('/debug-comfy', async (req, res) => {
  try {
    // Test 1: List available models
    const testResponse = await axios.get('https://api.comfy.org/api/models', {
      headers: {
        'Authorization': `Bearer ${COMFY_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    res.json({
      success: true,
      message: 'Comfy API connection successful!',
      models: testResponse.data.models || testResponse.data,
      endpoints: Object.keys(COMFY_API_ENDPOINTS)
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
  }
});

// Updated generate endpoint
app.post('/generate', async (req, res) => {
  const { prompt, width = 1024, height = 1024, steps = 4, endpoint = 'flux' } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log('=== GENERATE REQUEST ===');
  console.log('Prompt:', prompt.substring(0, 50) + '...');
  console.log('Dimensions:', width + 'x' + height);
  console.log('API Key exists:', !!COMFY_API_KEY);
  console.log('Selected endpoint:', endpoint);

  // Test each endpoint until one works
  const testEndpoint = COMFY_API_ENDPOINTS[endpoint] || COMFY_API_ENDPOINTS.flux;
  
  console.log('Trying endpoint:', testEndpoint);
  
  try {
    // First, let's verify the API key works
    console.log('Testing API key...');
    const testReq = await axios.get('https://api.comfy.org/api/models', {
      headers: {
        'Authorization': `Bearer ${COMFY_API_KEY}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('API key test result:', testReq.status);
    
    // Now try to generate
    const payload = {
      prompt: prompt,
      width: parseInt(width),
      height: parseInt(height),
      steps: parseInt(steps),
      guidance_scale: 3.5,
      output_format: 'webp',
      model: 'flux-dev'  // Try different models
    };
    
    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(
      testEndpoint,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${COMFY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 300000  // 5 minutes for generation
      }
    );

    console.log('Comfy API Response Status:', response.status);
    console.log('Comfy API Response Data:', JSON.stringify(response.data, null, 2));

    // Forward the response
    res.json({
      success: true,
      image_url: response.data.images?.[0]?.url || response.data.url || response.data.image_url,
      seed: response.data.seed,
      id: response.data.id || response.data.request_id,
      full_response: response.data  // For debugging
    });

  } catch (error) {
    console.error('=== COMFT API ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      res.status(error.response.status).json({
        error: 'Comfy API Error',
        status: error.response.status,
        details: error.response.data,
        message: error.response.data?.error || error.response.data?.message || 'Unknown error',
        suggestion: 'Check your API key and endpoint'
      });
    } else if (error.request) {
      console.error('No response received');
      res.status(504).json({
        error: 'No response from Comfy API',
        message: 'The request timed out or Comfy API is unreachable',
        suggestion: 'Try again in a few minutes'
      });
    } else {
      console.error('Request setup error:', error.message);
      res.status(500).json({
        error: 'Request setup failed',
        message: error.message
      });
    }
  }
});

// Test endpoint to try all possible configurations
app.post('/test-all-endpoints', async (req, res) => {
  const testPrompt = req.body.prompt || "a simple test";
  const results = {};
  
  for (const [name, endpoint] of Object.entries(COMFY_API_ENDPOINTS)) {
    try {
      console.log(`Testing endpoint: ${name} (${endpoint})`);
      
      const response = await axios.post(
        endpoint,
        {
          prompt: testPrompt,
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
      
      results[name] = {
        success: true,
        status: response.status,
        data: response.data
      };
      
    } catch (error) {
      results[name] = {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }
  
  res.json({
    prompt: testPrompt,
    apiKeyPreview: COMFY_API_KEY ? COMFY_API_KEY.substring(0, 8) + '...' : 'none',
    results: results
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Debug server running on port ${PORT}`);
  console.log(`API Key present: ${COMFY_API_KEY ? 'YES' : 'NO'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Debug endpoint: http://localhost:${PORT}/debug-comfy`);
});
