require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

let db;

// DB INIT
(async () => {
  db = await open({
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
})();

// 🔥 IMAGE GENERATION (DEMO READY)
app.post("/api/generate", async (req, res) => {
  const prompt =
    "Chinese New Year Fire Horse, hope you get rich, 马上有钱, " +
    req.body.prompt;

  // DEMO IMAGE (replace with real AI later)
  const image_url =
    "https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=800&q=80";

  await db.run(
    "INSERT INTO artworks (prompt, image_url) VALUES (?, ?)",
    [prompt, image_url]
  );

  res.json({
    success: true,
    artwork: { image_url }
  });
});

// 🖼️ GALLERY
app.get("/api/gallery", async (req, res) => {
  const artworks = await db.all(
    "SELECT * FROM artworks ORDER BY id DESC LIMIT 20"
  );
  res.json({ success: true, artworks });
});

app.listen(PORT, () =>
  console.log(`🔥 Fire Horse API running on port ${PORT}`)
);
