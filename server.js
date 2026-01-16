const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/generated', express.static('generated'));

// Create directories if they don't exist
async function ensureDirectories() {
    try {
        await fs.mkdir('generated', { recursive: true });
    } catch (err) {
        console.error('Error creating directories:', err);
    }
}

// ComfyUI API Configuration
const COMFYUI_API_URL = 'https://comfyui-proxy.onrender.com';
const COMFY_API_KEY = process.env.COMFY_API_KEY || 'sk-adREr3pU49iPRSkj7sBCa7NDMpWtV9NuMoiqNfylHCl9GP9u';

// Default workflow (you may need to adjust based on your ComfyUI setup)
const DEFAULT_WORKFLOW = {
    "prompt": {
        "3": {
            "inputs": {
                "seed": 42,
                "steps": 20,
                "cfg": 8,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": [
                    "4",
                    0
                ],
                "positive": [
                    "6",
                    0
                ],
                "negative": [
                    "7",
                    0
                ],
                "latent_image": [
                    "5",
                    0
                ]
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
                "width": 512,
                "height": 512,
                "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {
                "text": "beautiful scenery",
                "clip": [
                    "4",
                    1
                ]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft",
                "clip": [
                    "4",
                    1
                ]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": [
                    "3",
                    0
                ],
                "vae": [
                    "4",
                    2
                ]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": "ComfyUI",
                "images": [
                    "8",
                    0
                ]
            },
            "class_type": "SaveImage"
        }
    }
};

// Generate image endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, negative_prompt = "", width = 512, height = 512 } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Clone the workflow and update with user inputs
        const workflow = JSON.parse(JSON.stringify(DEFAULT_WORKFLOW));
        workflow.prompt["6"].inputs.text = prompt;
        workflow.prompt["7"].inputs.text = negative_prompt;
        workflow.prompt["5"].inputs.width = width;
        workflow.prompt["5"].inputs.height = height;

        // Generate a unique seed
        const seed = Math.floor(Math.random() * 4294967295);
        workflow.prompt["3"].inputs.seed = seed;

        console.log('Sending request to ComfyUI...');

        // Queue prompt
        const queueResponse = await axios.post(
            `${COMFYUI_API_URL}/api/v1/prompts`,
            { prompt: workflow.prompt },
            {
                headers: {
                    'Authorization': `Bearer ${COMFY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const promptId = queueResponse.data.prompt_id;
        console.log('Prompt queued with ID:', promptId);

        // Poll for completion
        let imageData = null;
        let attempts = 0;
        const maxAttempts = 50;

        while (!imageData && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));

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
                            const imageUrl = `${COMFYUI_API_URL}/api/v1/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                            
                            // Download the image
                            const imageResponse = await axios.get(imageUrl, {
                                responseType: 'arraybuffer',
                                headers: {
                                    'Authorization': `Bearer ${COMFY_API_KEY}`
                                }
                            });

                            // Generate unique filename
                            const filename = `image_${uuidv4()}.png`;
                            const filepath = path.join(__dirname, 'generated', filename);
                            
                            // Save the image
                            await sharp(imageResponse.data)
                                .png()
                                .toFile(filepath);

                            // Create thumbnail
                            const thumbnailName = `thumb_${filename}`;
                            const thumbnailPath = path.join(__dirname, 'generated', thumbnailName);
                            await sharp(imageResponse.data)
                                .resize(200, 200, { fit: 'cover' })
                                .toFile(thumbnailPath);

                            imageData = {
                                url: `/generated/${filename}`,
                                thumbnail: `/generated/${thumbnailName}`,
                                prompt: prompt,
                                timestamp: new Date().toISOString(),
                                seed: seed
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

// Get gallery images
app.get('/api/gallery', async (req, res) => {
    try {
        const files = await fs.readdir('generated');
        const images = [];
        
        for (const file of files) {
            if (file.startsWith('image_') && file.endsWith('.png')) {
                const thumbnail = `thumb_${file}`;
                const stats = await fs.stat(path.join('generated', file));
                
                images.push({
                    url: `/generated/${file}`,
                    thumbnail: `/generated/${thumbnail}`,
                    timestamp: stats.mtime.toISOString(),
                    prompt: 'Generated image' // You might want to store prompts separately
                });
            }
        }
        
        // Sort by most recent first
        images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(images);
    } catch (error) {
        console.error('Error reading gallery:', error);
        res.status(500).json({ error: 'Failed to load gallery' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
    await ensureDirectories();
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Gallery available at http://localhost:${PORT}`);
        console.log(`API available at http://localhost:${PORT}/api`);
    });
}

startServer();
