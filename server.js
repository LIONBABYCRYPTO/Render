// server.js - GEMINI API VERSION
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// 🔧 CONFIGURATION - From the Python code
const GEMINI_API_KEY = process.env.COMFY_API_KEY || 'sk-adREr3pU49iPRSkj7sBCa7NDMpWtV9NuMoiqNfylHCl9GP9u';
const GEMINI_BASE_URL = 'https://api.mmw.ink'; // From the Python code
const GEMINI_MODEL = 'gemini-3-pro-image-preview-2k'; // From the Python code

console.log('='.repeat(60));
console.log('🎨 Gemini Image Generation API Gateway');
console.log('='.repeat(60));
console.log('Service: Gemini AI via mmw.ink proxy');
console.log('API Key:', GEMINI_API_KEY.substring(0, 12) + '...');
console.log('Base URL:', GEMINI_BASE_URL);
console.log('Model:', GEMINI_MODEL);
console.log('Purchase: Nano Banana 200次调用');
console.log('='.repeat(60));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Gemini Image Generation API',
    config: {
      base_url: GEMINI_BASE_URL,
      model: GEMINI_MODEL,
      key_configured: true
    },
    endpoints: {
      health: '/health',
      test: '/test-gemini',
      generate: '/generate'
    },
    usage: '200 calls total (Nano Banana Pro 2.0)'
  });
});

// Test Gemini API connection
app.get('/test-gemini', async (req, res) => {
  console.log('Testing Gemini API connection...');
  
  try {
    // Test 1: Try with Bearer token (as shown in Python code)
    const testResponse = await axios.post(
      `${GEMINI_BASE_URL}/v1/models/${GEMINI_MODEL}:generateContent`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "a simple test image"
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT"], // Just test with text response
          temperature: 0.7
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000,
        validateStatus: () => true // Accept all status codes
      }
    );
    
    res.json({
      test: 'completed',
      method: 'Bearer token',
      status: testResponse.status,
      success: testResponse.status < 400,
      response: testResponse.data,
      suggestion: testResponse.status === 200 ? 
        'API is working! Try /generate endpoint' :
        'Check API key format'
    });
    
  } catch (error) {
    res.json({
      test: 'failed',
      error: error.code || error.message,
      message: error.message,
      suggestion: 'Contact seller if API key is not working'
    });
  }
});

// Main generation endpoint - Gemini API format
app.post('/generate', async (req, res) => {
  const { prompt, image_size = "2K" } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  // Validate image size
  const validSizes = ["1K", "2K", "4K"];
  const size = validSizes.includes(image_size.toUpperCase()) ? image_size.toUpperCase() : "2K";
  
  console.log(`Generating image: "${prompt.substring(0, 50)}..."`);
  console.log(`Size: ${size}, Model: ${GEMINI_MODEL}`);
  
  const apiUrl = `${GEMINI_BASE_URL}/v1/models/${GEMINI_MODEL}:generateContent`;
  
  try {
    // Prepare request in Gemini API format
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          imageSize: size
        },
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };
    
    console.log('Sending to Gemini API:', apiUrl);
    
    // Try with Bearer token first (as shown in Python code)
    const response = await axios.post(
      apiUrl,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 300000 // 5 minutes for image generation
      }
    );
    
    console.log('Gemini API response status:', response.status);
    
    // Parse Gemini API response
    let imageData = null;
    let imageUrl = null;
    let texts = [];
    
    // Check for inline image data
    const candidates = response.data.candidates || [];
    for (const candidate of candidates) {
      const content = candidate.content;
      if (content && content.parts) {
        for (const part of content.parts) {
          // Check for inline image data
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data;
          }
          // Check for text that might contain URLs
          if (part.text) {
            texts.push(part.text);
            // Extract URLs from text
            const urlRegex = /https?:\/\/[^\s)]+/g;
            const urls = part.text.match(urlRegex);
            if (urls && urls.length > 0 && !imageUrl) {
              imageUrl = urls[0];
            }
          }
        }
      }
    }
    
    // If we have inline image data, convert to data URL
    if (imageData) {
      const imageBuffer = Buffer.from(imageData, 'base64');
      const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      
      res.json({
        success: true,
        image_url: dataUrl,
        image_data: imageData.substring(0, 100) + '...', // First 100 chars
        format: 'base64',
        model: GEMINI_MODEL,
        size: size,
        prompt: prompt,
        remaining_calls: '200 total (Nano Banana)',
        note: 'Image sent as base64 data URL'
      });
      
    } 
    // If we found an image URL
    else if (imageUrl) {
      res.json({
        success: true,
        image_url: imageUrl,
        model: GEMINI_MODEL,
        size: size,
        prompt: prompt,
        remaining_calls: '200 total (Nano Banana)',
        note: 'Image available at the URL above'
      });
      
    } 
    // If no image found
    else {
      // Try to download from any URLs found in text
      if (texts.length > 0) {
        const allText = texts.join(' ');
        const urlRegex = /https?:\/\/[^\s)]+/g;
        const allUrls = allText.match(urlRegex) || [];
        
        if (allUrls.length > 0) {
          res.json({
            success: true,
            image_url: allUrls[0],
            alternative_urls: allUrls.slice(1),
            model: GEMINI_MODEL,
            size: size,
            prompt: prompt,
            remaining_calls: '200 total (Nano Banana)',
            note: 'Found URL in response text'
          });
        } else {
          res.json({
            success: false,
            message: 'No image found in response',
            text_response: texts,
            full_response: response.data,
            suggestion: 'Try a different prompt'
          });
        }
      } else {
        res.json({
          success: false,
          message: 'No image or text in response',
          full_response: response.data
        });
      }
    }
    
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    
    // Try alternative API key format if Bearer fails
    if (error.response && error.response.status === 401) {
      console.log('Trying alternative API key format...');
      
      try {
        // Try with API key in query parameter or different header
        const altResponse = await axios.post(
          `${GEMINI_BASE_URL}/generate`,
          {
            prompt: prompt,
            model: GEMINI_MODEL,
            size: size
          },
          {
            headers: {
              'X-API-Key': GEMINI_API_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 300000
          }
        );
        
        if (altResponse.data && altResponse.data.image_url) {
          res.json({
            success: true,
            image_url: altResponse.data.image_url,
            method: 'Alternative format',
            model: GEMINI_MODEL,
            size: size,
            prompt: prompt
          });
        } else {
          throw new Error('Alternative format also failed');
        }
        
      } catch (altError) {
        res.status(500).json({
          error: 'Gemini API authentication failed',
          details: 'Both Bearer token and alternative formats failed',
          status: error.response?.status || altError.response?.status,
          suggestion: '1. Check API key is correct\n2. Contact seller\n3. Check tutorial document'
        });
      }
      
    } else if (error.response) {
      res.status(error.response.status).json({
        error: 'Gemini API Error',
        status: error.response.status,
        details: error.response.data,
        url: apiUrl,
        suggestion: 'Check the API endpoint format'
      });
    } else if (error.request) {
      res.status(504).json({
        error: 'Connection failed',
        message: 'Cannot connect to Gemini API',
        url: apiUrl,
        suggestion: '1. Check if https://api.mmw.ink is accessible\n2. Contact seller'
      });
    } else {
      res.status(500).json({
        error: 'Internal error',
        message: error.message
      });
    }
  }
});

// Simple text-to-image endpoint
app.post('/simple-generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.json({ error: 'Prompt required' });
    }
    
    const response = await axios.post(
      `${GEMINI_BASE_URL}/v1/models/${GEMINI_MODEL}:generateContent`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            imageSize: "2K"
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000
      }
    );
    
    res.json({
      success: true,
      data: response.data,
      note: 'Check candidates[0].content.parts for image data'
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      data: error.response?.data
    });
  }
});

// Check remaining calls/balance
app.get('/balance', async (req, res) => {
  try {
    // Try to get account info
    const response = await axios.get(
      `${GEMINI_BASE_URL}/v1/usage`,
      {
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Accept': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    
    if (response.status === 200) {
      res.json({
        success: true,
        usage: response.data,
        purchased: '200 calls (Nano Banana Pro 2.0)'
      });
    } else {
      res.json({
        success: false,
        status: response.status,
        message: 'Usage endpoint not available',
        purchased: '200 calls total from purchase'
      });
    }
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      purchased: '200 calls (Nano Banana Pro 2.0)',
      note: 'Check with seller for exact remaining balance'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Gemini API Gateway running on port ${PORT}`);
  console.log('\n📋 Available Endpoints:');
  console.log(`  Health:          https://comfyui-proxy.onrender.com/health`);
  console.log(`  Test API:        https://comfyui-proxy.onrender.com/test-gemini`);
  console.log(`  Check balance:   https://comfyui-proxy.onrender.com/balance`);
  console.log(`  Simple generate: POST https://comfyui-proxy.onrender.com/simple-generate`);
  console.log(`  Generate image:  POST https://comfyui-proxy.onrender.com/generate`);
  console.log('\n🎨 Example curl command:');
  console.log(`  curl -X POST https://comfyui-proxy.onrender.com/generate \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"prompt":"a beautiful sunset", "image_size":"2K"}'`);
  console.log('\n⚠️  Note: This is a Gemini AI service, not ComfyUI');
});
