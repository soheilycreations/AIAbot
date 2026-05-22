/**
 * replyEngine.js — OpenRouter AI Version (Strict Knowledge Base)
 */

const axios = require("axios");
const supabase = require("./supabaseClient");

const conversationHistory = new Map();
const MAX_HISTORY = 10;

// ── Keyword match ─────────────────────────────────────────────────────────────
async function keywordMatch(shopId, text) {
  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true);

  if (!faqs || faqs.length === 0) return null;

  const lower = text.toLowerCase();
  for (const faq of faqs) {
    if (faq.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) {
      return faq.answer;
    }
    if (lower.includes(faq.question.toLowerCase())) {
      return faq.answer;
    }
  }
  return null;
}

// ── Build context ─────────────────────────────────────────────────────────────
async function buildContext(shopId) {
  const { data: faqs } = await supabase
    .from("faqs")
    .select("question, answer")
    .eq("shop_id", shopId)
    .eq("is_active", true);

  const { data: docs } = await supabase
    .from("knowledge_docs")
    .select("file_name, content")
    .eq("shop_id", shopId);

  let context = "";

  if (docs && docs.length > 0) {
    context += "## BUSINESS RULES & KNOWLEDGE DOCUMENTS\n";
    docs.forEach((doc) => {
      context += `### ${doc.file_name}\n${doc.content.slice(0, 4000)}\n\n`;
    });
  }

  if (faqs && faqs.length > 0) {
    context += "## QUICK FAQ ANSWERS\n";
    context += faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
    context += "\n\n";
  }

  return context || "No knowledge base configured yet.";
}

// ── OpenRouter AI reply ───────────────────────────────────────────────────────
async function aiReply(shopId, senderJid, text) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log(`[${shopId}] OPENROUTER_API_KEY not set`);
    return null;
  }

  const context = await buildContext(shopId);

  if (!conversationHistory.has(senderJid)) {
    conversationHistory.set(senderJid, []);
  }
  const history = conversationHistory.get(senderJid);

  // Add user message
  history.push({ role: "user", content: text });

  // Keep only last N messages
  if (history.length > MAX_HISTORY * 2) {
    history.splice(0, 2);
  }

  const systemPrompt = `You are the official AI sales assistant for this business. Your ONLY job is to answer customer questions using the KNOWLEDGE BASE provided below.

CRITICAL RULES — FOLLOW STRICTLY:
1. ONLY use information from the KNOWLEDGE BASE below. Do NOT make up prices, services, or details.
2. If the knowledge base has specific rules, tone, or persona instructions — follow them EXACTLY.
3. Reply in the EXACT SAME language the customer uses (Sinhala → Sinhala reply, English → English reply).
4. Keep replies SHORT — max 3-4 sentences for WhatsApp. No long paragraphs.
5. If customer asks something NOT in the knowledge base, say you will connect them with the team.
6. NEVER invent or guess information. Use ONLY what is in the knowledge base.
7. Use emojis naturally but sparingly.

═══════════════════════════════════════
KNOWLEDGE BASE — YOUR ONLY SOURCE OF TRUTH:
═══════════════════════════════════════
${context}
═══════════════════════════════════════`;

  const models = [
    process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
    "anthropic/claude-haiku-4-5",
    "openai/gpt-4o-mini",
    "google/gemma-3-1b-it:free",
  ];

  for (const model of models) {
    try {
      console.log(`[${shopId}] Trying model: ${model}`);

      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
          ],
          max_tokens: 300,
          temperature: 0.5,
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://whatsapp-bot-backend-27d8.onrender.com",
            "X-Title": "WhatsApp Bot Platform",
          },
          timeout: 30000,
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        console.log(`[${shopId}] Empty reply from ${model}, trying next...`);
        continue;
      }

      // Save assistant reply to history
      history.push({ role: "assistant", content: reply });

      console.log(`[${shopId}] ✓ OpenRouter reply (${model}): ${reply.substring(0, 80)}...`);
      return reply;

    } catch (err) {
      const code = err.response?.data?.error?.code;
      console.error(`[${shopId}] ${model} error (${code}):`, err.response?.data?.error?.message || err.message);

      // If rate limited or not found, try next model
      if (code === 429 || code === 404) continue;

      // Other errors - stop trying
      break;
    }
  }

  console.log(`[${shopId}] All models failed`);
  return null;
}

// ── Log to Supabase ───────────────────────────────────────────────────────────
async function logMessage(shopId, senderJid, messageText, replySent, replyType) {
  await supabase.from("messages").insert({
    shop_id: shopId,
    sender_jid: senderJid,
    message_text: messageText,
    reply_sent: replySent,
    reply_type: replyType,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function handleIncomingMessage(shopId, senderJid, text, waSocket) {
  try {
    const { data: shop } = await supabase
      .from("shops")
      .select("auto_reply")
      .eq("id", shopId)
      .single();

    if (!shop?.auto_reply) {
      await logMessage(shopId, senderJid, text, null, "none");
      return;
    }

    let reply = null;
    let replyType = "none";

    // 1. Keyword match first (fast, free)
    reply = await keywordMatch(shopId, text);
    if (reply) {
      replyType = "keyword";
      console.log(`[${shopId}] ✓ Keyword match`);
    }

    // 2. OpenRouter AI fallback
    if (!reply) {
      try {
        reply = await aiReply(shopId, senderJid, text);
        if (reply) {
          replyType = "ai";
        }
      } catch (err) {
        console.error(`[${shopId}] AI error:`, err.message);
      }
    }

    // 3. Send reply
    if (reply) {
      await waSocket.sendMessage(senderJid, { text: reply });
      console.log(`[${shopId}] → Sent (${replyType})`);
    }

    // 4. Log
    await logMessage(shopId, senderJid, text, reply, replyType);
  } catch (err) {
    console.error(`[${shopId}] Error:`, err.message);
  }
}

module.exports = { handleIncomingMessage };
