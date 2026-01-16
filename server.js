// server.js - Complete Backend with Gallery System
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Configuration
const GEMINI_API_KEY = process.env.COMFY_API_KEY || 'sk-adREr3pU49iPRSkj7sBCa7NDMpWtV9NuMoiqNfylHCl9GP9u';
const GEMINI_BASE_URL = 'https://api.mmw.ink';
const GEMINI_MODEL = 'gemini-3-pro-image-preview-2k';

// Database setup
let db;
(async () => {
    try {
        db = await open({
            filename: path.join(__dirname, 'gallery.db'),
            driver: sqlite3.Database
        });

        // Create artworks table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS artworks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT NOT NULL,
                image_url TEXT NOT NULL,
                style TEXT DEFAULT 'digital',
                user_ip TEXT,
                user_agent TEXT,
                likes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create votes table (prevent duplicate likes)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artwork_id INTEGER,
                voter_ip TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(artwork_id, voter_ip)
            )
        `);

        console.log('✅ Database initialized successfully');
        
        // Add sample artworks if empty
        const count = await db.get('SELECT COUNT(*) as count FROM artworks');
        if (count.count === 0) {
            await addSampleArtworks();
        }
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
    }
})();

// Add sample artworks
async function addSampleArtworks() {
    const samples = [
        {
            prompt: "Fire Dragon Horse with golden scales, surrounded by cryptocurrency symbols, futuristic",
            image_url: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "digital"
        },
        {
            prompt: "Chinese ink painting style fire horse, traditional art with modern elements",
            image_url: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "chinese"
        },
        {
            prompt: "Cyberpunk fire horse with mechanical armor, neon city background",
            image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "cyberpunk"
        },
        {
            prompt: "Fantasy fire horse with magic runes, epic landscape, digital painting",
            image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "fantasy"
        },
        {
            prompt: "Fire horse running through digital universe, crypto coins flowing",
            image_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "digital"
        },
        {
            prompt: "Traditional Chinese fire horse with modern digital art fusion",
            image_url: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "chinese"
        }
    ];

    for (const artwork of samples) {
        await db.run(
            'INSERT INTO artworks (prompt, image_url, style, likes) VALUES (?, ?, ?, ?)',
            [artwork.prompt, artwork.image_url, artwork.style, Math.floor(Math.random() * 50) + 10]
        );
    }
    console.log('✅ Sample artworks added');
}

// ============ API ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Fire Horse Art Generator',
        version: '2.0.0',
        features: ['generate', 'gallery', 'likes'],
        timestamp: new Date().toISOString()
    });
});

// Generate new artwork
app.post('/api/generate', async (req, res) => {
    const { prompt, style = 'digital', user_agent = '' } = req.body;
    const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!prompt || prompt.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Prompt is required (min 3 characters)' });
    }

    console.log(`🎨 Generating: "${prompt.substring(0, 50)}..."`);

    try {
        // Enhance prompt with fire horse theme
        let enhancedPrompt = prompt.toLowerCase().includes('fire') && 
                            (prompt.toLowerCase().includes('horse') || prompt.toLowerCase().includes('dragon')) 
            ? prompt 
            : `Fire Dragon Horse, ${prompt}, golden scales, flames, cryptocurrency elements, Chinese New Year theme`;

        // Add style-specific enhancements
        const styleEnhancements = {
            'digital': 'digital art, futuristic, cyber elements',
            'chinese': 'Chinese ink painting, traditional style',
            'cyberpunk': 'cyberpunk, neon, mechanical',
            'fantasy': 'fantasy, magical, epic'
        };
        
        enhancedPrompt += `, ${styleEnhancements[style] || styleEnhancements.digital}`;

        // Call Gemini API
        const response = await axios.post(
            `${GEMINI_BASE_URL}/v1/models/${GEMINI_MODEL}:generateContent`,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: enhancedPrompt }]
                }],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                    imageConfig: { imageSize: "2K" }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${GEMINI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 300000 // 5 minutes
            }
        );

        // Parse response for image
        let imageUrl = null;
        const candidates = response.data.candidates || [];

        for (const candidate of candidates) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData?.data) {
                        // Convert to data URL
                        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                        break;
                    }
                }
            }
            if (imageUrl) break;
        }

        // Fallback to Unsplash if no image
        if (!imageUrl) {
            const fallbackImages = {
                'digital': 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                'chinese': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                'cyberpunk': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                'fantasy': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
            };
            imageUrl = fallbackImages[style] || fallbackImages.digital;
        }

        // Save to database
        const result = await db.run(
            'INSERT INTO artworks (prompt, image_url, style, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)',
            [enhancedPrompt, imageUrl, style, userIp, user_agent]
        );

        const newArtwork = await db.get('SELECT * FROM artworks WHERE id = ?', [result.lastID]);

        res.json({
            success: true,
            artwork: newArtwork,
            message: 'Fire Horse artwork created successfully!'
        });

    } catch (error) {
        console.error('Generation error:', error.message);

        // Fallback response
        const fallbackImages = {
            'digital': 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'chinese': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'cyberpunk': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'fantasy': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        const imageUrl = fallbackImages[style] || fallbackImages.digital;

        const result = await db.run(
            'INSERT INTO artworks (prompt, image_url, style, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)',
            [`${prompt} (demo mode)`, imageUrl, style, userIp, user_agent]
        );

        const newArtwork = await db.get('SELECT * FROM artworks WHERE id = ?', [result.lastID]);

        res.json({
            success: true,
            artwork: newArtwork,
            message: 'Fire Horse artwork created! (Demo mode)'
        });
    }
});

// Get gallery artworks
app.get('/api/gallery', async (req, res) => {
    try {
        const { page = 1, limit = 12, sort = 'newest', style } = req.query;
        const offset = (page - 1) * limit;

        let orderBy = 'created_at DESC';
        if (sort === 'popular') orderBy = 'likes DESC';
        if (sort === 'random') orderBy = 'RANDOM()';

        let query = 'SELECT * FROM artworks';
        const params = [];

        if (style && style !== 'all') {
            query += ' WHERE style = ?';
            params.push(style);
        }

        query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const artworks = await db.all(query, params);
        const total = await db.get('SELECT COUNT(*) as count FROM artworks' + (style && style !== 'all' ? ' WHERE style = ?' : ''), 
                                  style && style !== 'all' ? [style] : []);

        res.json({
            success: true,
            artworks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        console.error('Gallery error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get single artwork
app.get('/api/artwork/:id', async (req, res) => {
    try {
        const artwork = await db.get(
            'SELECT * FROM artworks WHERE id = ?',
            [req.params.id]
        );

        if (artwork) {
            res.json({ success: true, artwork });
        } else {
            res.status(404).json({ success: false, error: 'Artwork not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Like artwork
app.post('/api/artwork/:id/like', async (req, res) => {
    try {
        const artworkId = req.params.id;
        const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // Check if already liked
        const existingVote = await db.get(
            'SELECT * FROM votes WHERE artwork_id = ? AND voter_ip = ?',
            [artworkId, userIp]
        );

        if (existingVote) {
            return res.json({ success: false, message: 'You already liked this artwork' });
        }

        // Record vote
        await db.run(
            'INSERT INTO votes (artwork_id, voter_ip) VALUES (?, ?)',
            [artworkId, userIp]
        );

        // Update likes count
        await db.run(
            'UPDATE artworks SET likes = likes + 1 WHERE id = ?',
            [artworkId]
        );

        const updated = await db.get('SELECT likes FROM artworks WHERE id = ?', [artworkId]);

        res.json({
            success: true,
            message: 'Liked successfully!',
            likes: updated.likes
        });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        const totalArtworks = await db.get('SELECT COUNT(*) as count FROM artworks');
        const totalLikes = await db.get('SELECT SUM(likes) as total FROM artworks');
        const today = new Date().toISOString().split('T')[0];
        const todayArtworks = await db.get(
            'SELECT COUNT(*) as count FROM artworks WHERE date(created_at) = ?',
            [today]
        );

        res.json({
            success: true,
            stats: {
                totalArtworks: totalArtworks.count,
                totalLikes: totalLikes.total || 0,
                todayArtworks: todayArtworks.count,
                averageLikes: totalLikes.total ? (totalLikes.total / totalArtworks.count).toFixed(1) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Search artworks
app.get('/api/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, error: 'Search query too short' });
        }

        const artworks = await db.all(
            'SELECT * FROM artworks WHERE prompt LIKE ? ORDER BY created_at DESC LIMIT ?',
            [`%${q}%`, parseInt(limit)]
        );

        res.json({
            success: true,
            artworks,
            count: artworks.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'gallery.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🔥 Fire Horse Art Generator API');
    console.log('='.repeat(60));
    console.log(`🌐 Server: http://localhost:${PORT}`);
    console.log('📁 Database: gallery.db');
    console.log('📊 Endpoints:');
    console.log('  POST /api/generate     - Generate artwork');
    console.log('  GET  /api/gallery      - Browse gallery');
    console.log('  POST /api/artwork/:id/like - Like artwork');
    console.log('  GET  /api/stats        - Get statistics');
    console.log('  GET  /api/search?q=    - Search artworks');
    console.log('='.repeat(60));
});
