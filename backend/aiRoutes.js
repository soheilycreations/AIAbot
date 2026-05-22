/**
 * aiRoutes.js
 * Soheily Creations AI API
 * Handles text generation for WhatsApp bot
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");

// Use free Hugging Face Inference API
const HUGGING_FACE_API = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";

// POST /api/ai/generate
router.post("/generate", async (req, res) => {
  const { text, context, language = "auto" } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text required" });
  }

  try {
    const systemPrompt = `You are a friendly WhatsApp sales assistant. ${context || ""}

RULES:
- Reply in customer's language (detect automatically)
- Keep SHORT (2-4 sentences for WhatsApp)
- Use emojis 😊
- If product unavailable, suggest alternative
- Guide to purchase
- Be warm & professional`;

    const prompt = `${systemPrompt}

Customer: ${text}
Assistant:`;

    console.log(`[AI API] Generating reply for: ${text.substring(0, 50)}...`);

    // Call Hugging Face (FREE tier)
    const response = await axios.post(
      HUGGING_FACE_API,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.8,
          top_p: 0.95,
        },
      },
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    let reply = response.data?.[0]?.generated_text || "";

    // Extract just the assistant response
    if (reply.includes("Assistant:")) {
      reply = reply.split("Assistant:").pop().trim();
    }
    reply = reply.split("Customer:")[0].trim();

    // Clean up
    reply = reply
      .replace(/[*_`~]/g, "") // Remove markdown
      .split("\n")[0] // Take first line
      .substring(0, 500) // Max 500 chars
      .trim();

    if (!reply || reply.length < 3) {
      return res.status(500).json({ error: "Failed to generate reply" });
    }

    console.log(`[AI API] Generated: ${reply.substring(0, 50)}...`);

    res.json({
      success: true,
      reply: reply,
      length: reply.length,
    });
  } catch (err) {
    console.error(`[AI API] Error:`, err.message);
    res.status(500).json({
      error: err.message,
      fallback: "Thanks for your message! Please contact us for more details.",
    });
  }
});

module.exports = router;
