import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = 3001;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const IMAGE_API_KEY = process.env.IMAGE_API_KEY; 

if (!OPENROUTER_API_KEY) {
  console.warn("⚠️ Missing OPENROUTER_API_KEY in .env. AI chat won't work.");
} else {
  console.log(`🔐 OpenRouter API key loaded: ${OPENROUTER_API_KEY.slice(0, 15)}...`);
}

// ====== Middleware ======
app.use(cors());
app.use(bodyParser.json());

// ====== System Prompt ======
const systemPrompt = `
You are EchoSoul, a personal AI companion that helps users reflect on their thoughts and emotions.
You don't have access to user memories — rely only on the current conversation to guide your responses.
Be empathetic, brief, and insightful.
If you don’t have enough context to answer, say: "I’m still learning about you. Could you tell me more?"
`.trim();

// ====== Chat Endpoint ======
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: fullMessages,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      return res.status(500).json({ error: "Invalid response from OpenRouter." });
    }

    res.json({ reply: data.choices[0].message.content.trim() });
  } catch (error) {
    console.error("🔥 OpenRouter fetch error:", error);
    res.status(500).json({ error: "Server failed to fetch AI response." });
  }
});


app.post("/api/generate-image", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch("https://api.deepai.org/api/text2img", {
      method: "POST",
      headers: {
        "Api-Key": IMAGE_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ text: prompt }),
    });

    const data = await response.json();
    if (!data.output_url) throw new Error("No image URL returned");
    res.json({ imageUrl: data.output_url });
  } catch (error) {
    console.error("🖼️ Image generation error:", error.message);
    res.status(500).json({ error: "Failed to generate image" });
  }
});


app.post("/api/search", async (req, res) => {
  const { query } = req.body;
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    const data = await response.json();
    const answer = data.AbstractText || data.RelatedTopics?.[0]?.Text || "No result found.";
    res.json({ answer });
  } catch (err) {
    console.error("🌐 Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});


app.post("/api/transcribe", async (req, res) => {
  // TODO: Add actual voice transcription (file upload + API call)
  return res.status(501).json({ error: "Voice transcription not implemented on backend. Use browser voice input instead." });
});


app.listen(PORT, () => {
  console.log(`✅ EchoSoul AI server running at http://localhost:${PORT}`);
});