// gallery-server.js - 完整的画廊后端
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 10000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🔑 您的 Gemini API 配置
const GEMINI_API_KEY = process.env.COMFY_API_KEY || 'sk-adREr3pU49iPRSkj7sBCa7NDMpWtV9NuMoiqNfylHCl9GP9u';
const GEMINI_BASE_URL = 'https://api.mmw.ink';
const GEMINI_MODEL = 'gemini-3-pro-image-preview-2k';

// 📊 数据库初始化
let db;

(async () => {
    try {
        db = await open({
            filename: './gallery.db',
            driver: sqlite3.Database
        });

        // 创建用户作品表
        await db.exec(`
            CREATE TABLE IF NOT EXISTS artworks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT NOT NULL,
                image_url TEXT NOT NULL,
                style TEXT,
                user_ip TEXT,
                user_agent TEXT,
                likes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 创建投票表（防止重复投票）
        await db.exec(`
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artwork_id INTEGER,
                voter_ip TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(artwork_id, voter_ip)
            )
        `);

        console.log('✅ 数据库初始化完成');
        
        // 添加一些示例数据（如果没有数据）
        const count = await db.get('SELECT COUNT(*) as count FROM artworks');
        if (count.count === 0) {
            await addSampleArtworks();
        }
        
    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
    }
})();

// 添加示例作品
async function addSampleArtworks() {
    const sampleArtworks = [
        {
            prompt: "金色火龙马，身披火焰，踏云而行，加密货币符号环绕",
            image_url: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "digital"
        },
        {
            prompt: "水墨风格龙马，火焰鬃毛，传统与现代艺术结合",
            image_url: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "chinese"
        },
        {
            prompt: "赛博朋克火龙，机械铠甲，霓虹城市，数字货币流动",
            image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "cyberpunk"
        },
        {
            prompt: "奇幻火龙神骏，魔法符文，星空背景，史诗场景",
            image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "fantasy"
        },
        {
            prompt: "火焰龙马，金色鳞甲，数字货币宇宙，未来科技感",
            image_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "digital"
        },
        {
            prompt: "国风龙马，祥云火焰，传统图案融合现代数字艺术",
            image_url: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            style: "chinese"
        }
    ];

    for (const artwork of sampleArtworks) {
        await db.run(
            'INSERT INTO artworks (prompt, image_url, style, likes) VALUES (?, ?, ?, ?)',
            [artwork.prompt, artwork.image_url, artwork.style, Math.floor(Math.random() * 50) + 10]
        );
    }
    console.log('✅ 示例作品添加完成');
}

// 🏥 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: '火龙艺术生成器',
        version: '1.0.0',
        features: ['生成', '画廊', '点赞'],
        timestamp: new Date().toISOString()
    });
});

// 🖼️ 获取画廊作品
app.get('/api/gallery', async (req, res) => {
    try {
        const { page = 1, limit = 12, sort = 'newest' } = req.query;
        const offset = (page - 1) * limit;

        let orderBy = 'created_at DESC';
        if (sort === 'popular') orderBy = 'likes DESC';
        if (sort === 'random') orderBy = 'RANDOM()';

        const artworks = await db.all(
            `SELECT * FROM artworks ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );

        const total = await db.get('SELECT COUNT(*) as count FROM artworks');

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
        console.error('画廊获取错误:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 🎨 获取单个作品
app.get('/api/artwork/:id', async (req, res) => {
    try {
        const artwork = await db.get(
            'SELECT * FROM artworks WHERE id = ?',
            [req.params.id]
        );

        if (artwork) {
            res.json({ success: true, artwork });
        } else {
            res.status(404).json({ success: false, error: '作品不存在' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// ❤️ 点赞作品
app.post('/api/artwork/:id/like', async (req, res) => {
    try {
        const artworkId = req.params.id;
        const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // 检查是否已经点赞
        const existingVote = await db.get(
            'SELECT * FROM votes WHERE artwork_id = ? AND voter_ip = ?',
            [artworkId, userIp]
        );

        if (existingVote) {
            return res.json({ success: false, message: '您已经点赞过这个作品了' });
        }

        // 记录投票
        await db.run(
            'INSERT INTO votes (artwork_id, voter_ip) VALUES (?, ?)',
            [artworkId, userIp]
        );

        // 更新点赞数
        await db.run(
            'UPDATE artworks SET likes = likes + 1 WHERE id = ?',
            [artworkId]
        );

        const updated = await db.get('SELECT likes FROM artworks WHERE id = ?', [artworkId]);

        res.json({
            success: true,
            message: '点赞成功！',
            likes: updated.likes
        });
    } catch (error) {
        console.error('点赞错误:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 🎨 生成新作品
app.post('/api/generate', async (req, res) => {
    const { prompt, style = 'digital', user_agent } = req.body;
    const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (!prompt) {
        return res.status(400).json({ success: false, error: '请输入描述' });
    }

    console.log(`🔄 生成作品: "${prompt.substring(0, 50)}..."`);

    try {
        // 增强提示词
        let enhancedPrompt = prompt;
        if (!prompt.includes('龙') && !prompt.includes('马') && !prompt.includes('火')) {
            enhancedPrompt = `火龙神骏，${prompt}，火焰特效，金色鳞甲，龙年吉祥`;
        }

        // 调用 Gemini API
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
                timeout: 300000
            }
        );

        // 解析响应
        let imageUrl = null;
        const candidates = response.data.candidates || [];

        for (const candidate of candidates) {
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        // 转换为 data URL
                        const dataUrl = `data:image/png;base64,${part.inlineData.data}`;
                        imageUrl = dataUrl;
                    }
                }
            }
        }

        if (!imageUrl) {
            // 如果没有图片数据，使用示例图片
            const samples = {
                'digital': 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                'chinese': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                'cyberpunk': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                'fantasy': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
            };
            imageUrl = samples[style] || samples.digital;
        }

        // 保存到数据库
        const result = await db.run(
            'INSERT INTO artworks (prompt, image_url, style, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)',
            [enhancedPrompt, imageUrl, style, userIp, user_agent]
        );

        const newArtwork = await db.get('SELECT * FROM artworks WHERE id = ?', [result.lastID]);

        res.json({
            success: true,
            artwork: newArtwork,
            message: '火龙神骏已降临！'
        });

    } catch (error) {
        console.error('生成错误:', error.message);

        // 降级处理：使用示例图片
        const samples = {
            'digital': 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'chinese': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'cyberpunk': 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'fantasy': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        const imageUrl = samples[style] || samples.digital;

        // 保存到数据库
        const result = await db.run(
            'INSERT INTO artworks (prompt, image_url, style, user_ip, user_agent) VALUES (?, ?, ?, ?, ?)',
            [`${prompt} (演示模式)`, imageUrl, style, userIp, user_agent]
        );

        const newArtwork = await db.get('SELECT * FROM artworks WHERE id = ?', [result.lastID]);

        res.json({
            success: true,
            artwork: newArtwork,
            message: '火龙神骏已降临！（演示模式）'
        });
    }
});

// 📊 获取统计数据
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
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 🗑️ 删除作品（管理功能）
app.delete('/api/artwork/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM artworks WHERE id = ?', [req.params.id]);
        await db.run('DELETE FROM votes WHERE artwork_id = ?', [req.params.id]);
        res.json({ success: true, message: '作品已删除' });
    } catch (error) {
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🔥 火龙艺术生成器已启动');
    console.log('='.repeat(60));
    console.log(`🌐 地址: http://localhost:${PORT}`);
    console.log('📁 数据库: gallery.db');
    console.log('📊 接口:');
    console.log('  GET  /api/gallery       - 获取画廊作品');
    console.log('  POST /api/generate      - 生成新作品');
    console.log('  POST /api/artwork/:id/like - 点赞作品');
    console.log('  GET  /api/stats         - 获取统计数据');
    console.log('='.repeat(60));
});
