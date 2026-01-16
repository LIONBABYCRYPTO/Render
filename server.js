const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ComfyUI API Configuration
const COMFYUI_API_URL = 'https://comfyui-proxy.onrender.com';
const COMFY_API_KEY = process.env.COMFY_API_KEY || 'sk-adREr3pU49iPRSkj7sBCa7NDMpWtV9NuMoiqNfylHCl9GP9u';

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Image Generator Backend'
    });
});

// Proxy endpoint for CORS issues
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, negative_prompt = "", width = 512, height = 512 } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const workflow = {
            "3": {
                "inputs": {
                    "seed": Math.floor(Math.random() * 4294967295),
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "v1-5-pruned-emaonly.ckpt"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": parseInt(width),
                    "height": parseInt(height),
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": prompt,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": negative_prompt || "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "Generated",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        };

        // Queue prompt
        const queueResponse = await axios.post(
            `${COMFYUI_API_URL}/api/v1/prompts`,
            { prompt: workflow },
            {
                headers: {
                    'Authorization': `Bearer ${COMFY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const promptId = queueResponse.data.prompt_id;

        // Poll for completion
        let imageData = null;
        let attempts = 0;
        const maxAttempts = 60;

        while (!imageData && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000));

            try {
                const historyResponse = await axios.get(
                    `${COMFYUI_API_URL}/api/v1/history/${promptId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${COMFY_API_KEY}`
                        }
                    }
                );

                const history = historyResponse.data;
                if (history && history[promptId]) {
                    const outputs = history[promptId].outputs;
                    for (const nodeId in outputs) {
                        const nodeOutput = outputs[nodeId];
                        if (nodeOutput.images && nodeOutput.images.length > 0) {
                            const image = nodeOutput.images[0];
                            let imageUrl = `${COMFYUI_API_URL}/api/v1/view?filename=${encodeURIComponent(image.filename)}&type=${image.type}`;
                            if (image.subfolder) {
                                imageUrl += `&subfolder=${encodeURIComponent(image.subfolder)}`;
                            }
                            
                            imageData = {
                                url: imageUrl,
                                prompt: prompt,
                                timestamp: new Date().toISOString()
                            };
                            break;
                        }
                    }
                }
            } catch (error) {
                console.log(`Attempt ${attempts}: Still processing...`);
            }
        }

        if (!imageData) {
            throw new Error('Image generation timed out');
        }

        res.json(imageData);

    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ 
            error: 'Failed to generate image', 
            details: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
});
