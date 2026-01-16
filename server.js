require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; // Render assigns port

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Optional: for frontend

// Your Comfy API Key - set in Render dashboard
const COMFY_API_KEY = process.env.COMFY_API_KEY;
const COMFY_API_URL = 'https://api.comfy.org/api/generate'; // Verify exact endpoint

// Health check endpoint (keeps service awake)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy endpoint
app.post('/generate', async (req, res) => {
  const { prompt, width = 1024, height = 1024, steps = 4 } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log(`Processing request: ${prompt.substring(0, 50)}...`);

  try {
    // Call Comfy API
    const response = await axios.post(
      COMFY_API_URL,
      {
        model: 'flux-dev', // Check available models
        prompt: prompt,
        width: width,
        height: height,
        steps: steps,
        output_format: 'webp',
        guidance_scale: 3.5
      },
      {
        headers: {
          'Authorization': `Bearer ${COMFY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 300000 // 5 minutes timeout
      }
    );

    // Forward response
    res.json({
      image_url: response.data.images?.[0]?.url || response.data.url,
      seed: response.data.seed,
      id: response.data.id
    });

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Better error handling
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'Comfy API Error', 
        details: error.response.data 
      });
    } else if (error.request) {
      res.status(504).json({ 
        error: 'Request timeout to Comfy API' 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error' 
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
});
