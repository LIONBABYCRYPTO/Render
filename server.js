import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { GoogleGenAI } from "@google/genai/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use("/images", express.static("/tmp"));

/* =======================
   DATABASE
======================= */
const db = await open({
  filename: "gallery.db",
  driver: sqlite3.Database
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS artworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

/* =======================
   GEMINI CLIENT
======================= */
const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: process.env.GEMINI_BASE_URL || "https://api.mmw.ink",
  timeout: 300000
});

const MODEL = "gemini-3-pro-image-preview-2k";
const IMAGE_SIZE = "2K";

/* =======================
   GENERATE IMAGE
======================= */
app.post("/api/generate", async (req, res) => {
  try {
    const userPrompt = req.body.prompt || "";

    const finalPrompt =
      `Chinese New Year Fire Horse, hope you get rich, 马上有钱, ultra detailed, cinematic lighting, ` +
      userPrompt;

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }]
        }
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { imageSize: IMAGE_SIZE }
      }
    });

    let imageBytes = null;
    let texts = [];

    for (const cand of response.candidates || []) {
      for (const part of cand.content?.parts || []) {
        if (part.inlineData?.data && !imageBytes) {
          imageBytes = Buffer.from(part.inlineData.data, "base64");
        }
        if (part.text) texts.push(part.text);
      }
    }

    if (!imageBytes) {
      throw new Error("No image returned from Gemini");
    }

    const fileName = `${uuidv4()}.png`;
    const filePath = path.join("/tmp", fileName);
    fs.writeFileSync(filePath, imageBytes);

    const imageUrl = `${req.protocol}://${req.get("host")}/images/${fileName}`;

    await db.run(
      "INSERT INTO artworks (prompt, image_url) VALUES (?, ?)",
      [finalPrompt, imageUrl]
    );

    res.json({
      success: true,
      artwork: { image_url: imageUrl }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =======================
   GALLERY
======================= */
app.get("/api/gallery", async (req, res) => {
  const artworks = await db.all(
    "SELECT * FROM artworks ORDER BY id DESC LIMIT 20"
  );
  res.json({ success: true, artworks });
});

app.listen(PORT, () =>
  console.log(`🔥 Fire Horse Gemini API running on ${PORT}`)
);
