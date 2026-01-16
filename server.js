// server.js - ACTUALLY USES GEMINI API
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ YOUR GEMINI API CONFIGURATION
const GEMINI_API_KEY = process.env.COMFY_API_KEY || process.env.API_KEY;
const GEMINI_BASE_URL = 'https://api.mmw.ink'; // From your tutorial
const GEMINI_MODEL = 'gemini-3-pro-image-preview-2k';

console.log('='.repeat(60));
console.log('🎯 GEMINI API CONFIGURATION');
console.log('='.repeat(60));
console.log('API Key present:', GEMINI_API_KEY ? '✅ YES' : '❌ NO');
if (GEMINI_API_KEY) {
    console.log('Key preview:', GEMINI_API_KEY.substring(0, 12) + '...');
}
console.log('Base URL:', GEMINI_BASE_URL);
console.log('Model:', GEMINI_MODEL);
console.log('='.repeat(60));

// Health check with API status
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Fire Horse AI Generator',
        api_configured: !!GEMINI_API_KEY,
        api_key_preview: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 8) + '...' : 'Not set',
        endpoints: ['/health', '/generate', '/test-api']
    });
});

// ✅ TEST API CONNECTION ENDPOINT
app.get('/test-api', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.json({
                success: false,
                error: 'No API key configured',
                instruction: 'Set COMFT_API_KEY in Render Environment Variables'
            });
        }
        
        console.log('🔍 Testing Gemini API connection...');
        
        // Test with a simple request
        const response = await axios.post(
            `${GEMINI_BASE_URL}/v1/models/${GEMINI_MODEL}:generateContent`,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: "test connection" }]
                }],
                generationConfig: {
                    responseModalities: ["TEXT"], // Just test with text
                    temperature: 0.7
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${GEMINI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        console.log('✅ API Test Response:', response.status);
        
        res.json({
            success: true,
            message: '✅ GEMINI API IS WORKING!',
            status: response.status,
            api_key_preview: GEMINI_API_KEY.substring(0, 12) + '...',
            response_preview: response.data
        });
        
    } catch (error) {
        console.error('❌ API Test Failed:', error.message);
        
        res.json({
            success: false,
            error: 'API Connection Failed',
            message: error.message,
            api_key_preview: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 12) + '...' : 'No key',
            suggestion: '1. Check API key\n2. Check endpoint URL\n3. Check internet connection'
        });
    }
});

// ✅ MAIN GENERATION ENDPOINT - ACTUALLY USES GEMINI API
app.post('/generate', async (req, res) => {
    const { prompt, image_size = "2K" } = req.body;
    
    if (!prompt || prompt.trim().length < 3) {
        return res.status(400).json({
            success: false,
            error: 'Prompt is required (min 3 characters)'
        });
    }
    
    console.log(`🎨 Generating image: "${prompt.substring(0, 50)}..."`);
    
    // Validate image size
    const validSizes = ["1K", "2K", "4K"];
    const size = validSizes.includes(image_size.toUpperCase()) ? image_size.toUpperCase() : "2K";
    
    try {
        // ✅ ENHANCE PROMPT FOR FIRE HORSE THEME
        let enhancedPrompt = prompt;
        if (!prompt.toLowerCase().includes('horse') && !prompt.toLowerCase().includes('dragon')) {
            enhancedPrompt = `Fire Dragon Horse, ${prompt}, golden scales, flames, Chinese New Year theme, ${size} quality`;
        } else {
            enhancedPrompt = `${prompt}, Chinese New Year theme, ${size} quality, detailed`;
        }
        
        console.log('📤 Sending to Gemini API:', enhancedPrompt);
        
        // ✅ ACTUAL GEMINI API CALL
        const response = await axios.post(
            `${GEMINI_BASE_URL}/v1/models/${GEMINI_MODEL}:generateContent`,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: enhancedPrompt }]
                }],
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"],
                    imageConfig: {
                        imageSize: size
                    },
                    temperature: 0.7
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${GEMINI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 300000 // 5 minutes for image generation
            }
        );
        
        console.log('✅ Gemini API Response Status:', response.status);
        
        // ✅ PARSE THE REAL GEMINI RESPONSE
        let imageUrl = null;
        let imageData = null;
        
        const candidates = response.data.candidates || [];
        for (const candidate of candidates) {
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    // Check for inline image data (base64)
                    if (part.inlineData && part.inlineData.data) {
                        imageData = part.inlineData.data;
                        // Convert to data URL
                        imageUrl = `data:image/png;base64,${imageData}`;
                        break;
                    }
                }
            }
            if (imageUrl) break;
        }
        
        // ✅ IF NO INLINE IMAGE, CHECK FOR URL IN TEXT
        if (!imageUrl && response.data) {
            const textResponse = JSON.stringify(response.data);
            // Look for URLs in the response
            const urlRegex = /https?:\/\/[^\s"]+\.(jpg|jpeg|png|gif|webp)/gi;
            const urls = textResponse.match(urlRegex);
            if (urls && urls.length > 0) {
                imageUrl = urls[0];
            }
        }
        
        // ✅ SUCCESS - RETURN REAL IMAGE FROM GEMINI
        if (imageUrl) {
            console.log('✅ Image generated successfully!');
            
            return res.json({
                success: true,
                image_url: imageUrl,
                prompt: prompt,
                enhanced_prompt: enhancedPrompt,
                size: size,
                source: 'gemini_api',
                message: '🎉 Fire Horse created with Gemini AI!'
            });
        }
        
        // ❌ No image found in response
        throw new Error('No image data in Gemini API response');
        
    } catch (error) {
        console.error('❌ Gemini API Error:', error.message);
        
        // ⚠️ FALLBACK TO DEMO IMAGES ONLY IF API FAILS
        const demoImages = {
            '1K': 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1024&q=80',
            '2K': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1024&q=80',
            '4K': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=1024&q=80'
        };
        
        const fallbackUrl = demoImages[size] || demoImages['2K'];
        
        // Return but indicate it's a fallback
        return res.json({
            success: true,
            image_url: fallbackUrl,
            prompt: prompt,
            size: size,
            source: 'fallback_demo',
            message: 'Image created (using demo - API unavailable)',
            api_error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Fire Horse Generator running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 Test API: http://localhost:${PORT}/test-api`);
    console.log(`🎨 Generate: POST http://localhost:${PORT}/generate`);
    console.log('='.repeat(60));
    console.log('⚠️  IMPORTANT: Set environment variable in Render:');
    console.log('   COMFT_API_KEY = your_gemini_api_key_here');
    console.log('='.repeat(60));
});
