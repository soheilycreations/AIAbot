/**
 * replyEngine.js — RAG-Powered Reply Engine
 * Uses pgvector similarity search for accurate context retrieval
 */

const axios = require("axios");
const supabase = require("./supabaseClient");
const { retrieveRelevantChunks } = require("./ragProcessor");

const conversationHistory = new Map();
const MAX_HISTORY = 8;

// ── Keyword match ─────────────────────────────────────────────────────────────
async function keywordMatch(shopId, text) {
  const { data: faqs } = await supabase
    .from("faqs").select("*").eq("shop_id", shopId).eq("is_active", true);

  if (!faqs?.length) return null;
  const lower = text.toLowerCase();
  for (const faq of faqs) {
    if (faq.keywords?.some(kw => lower.includes(kw.toLowerCase()))) return faq.answer;
    if (lower.includes(faq.question.toLowerCase())) return faq.answer;
  }
  return null;
}

// ── Fallback context (no RAG) ─────────────────────────────────────────────────
async function getFallbackContext(shopId) {
  const { data: faqs } = await supabase
    .from("faqs").select("question, answer").eq("shop_id", shopId).eq("is_active", true);
  const { data: docs } = await supabase
    .from("knowledge_docs").select("file_name, content").eq("shop_id", shopId);

  let context = "";
  if (docs?.length) {
    context += "## Business Rules & Knowledge\n";
    docs.forEach(doc => { context += `### ${doc.file_name}\n${doc.content.slice(0, 4000)}\n\n`; });
  }
  if (faqs?.length) {
    context += "## FAQ Answers\n";
    context += faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  }
  return context || "No knowledge base configured.";
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(context) {
  return `You are the official AI Sales Assistant for this business. Answer ONLY using the knowledge base below.

STRICT RULES:
1. Use ONLY information from KNOWLEDGE BASE. Never invent prices or services.
2. Reply in EXACT SAME language customer uses (Sinhala → Sinhala, English → English).
3. Keep replies SHORT — max 3-4 sentences for WhatsApp.
4. Follow tone/persona/rules in knowledge base EXACTLY.
5. If info not in knowledge base, say you will connect them with the team.
6. Use emojis naturally 😊.
7. End with gentle call-to-action.

═══════════════════════════════
KNOWLEDGE BASE:
═══════════════════════════════
${context}
═══════════════════════════════`;
}

// ── OpenRouter call with model fallback ───────────────────────────────────────
async function callOpenRouter(messages) {
  const models = [
    process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
    "anthropic/claude-haiku-4-5",
    "openai/gpt-4o-mini",
    "google/gemma-3-1b-it:free",
  ];

  for (const model of models) {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        { model, messages, max_tokens: 300, temperature: 0.4 },
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
      const reply = res.data?.choices?.[0]?.message?.content?.trim();
      if (reply) { console.log(`✓ (${model}): ${reply.substring(0, 60)}...`); return reply; }
    } catch (err) {
      const code = err.response?.data?.error?.code;
      console.error(`✗ ${model} (${code}): ${err.response?.data?.error?.message || err.message}`);
      if (code === 429 || code === 404) continue;
      break;
    }
  }
  return null;
}

// ── AI reply with RAG ─────────────────────────────────────────────────────────
async function aiReply(shopId, senderJid, text) {
  if (!process.env.OPENROUTER_API_KEY) return null;

  if (!conversationHistory.has(senderJid)) conversationHistory.set(senderJid, []);
  const history = conversationHistory.get(senderJid);

  // Try RAG first
  let context = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      context = await retrieveRelevantChunks(shopId, text, 5);
      if (context) console.log(`[${shopId}] ✓ RAG context retrieved`);
    } catch (err) {
      console.error(`[${shopId}] RAG error:`, err.message);
    }
  }

  // Fallback to full docs if RAG fails
  if (!context) {
    console.log(`[${shopId}] Using fallback context`);
    context = await getFallbackContext(shopId);
  }

  history.push({ role: "user", content: text });
  if (history.length > MAX_HISTORY * 2) history.splice(0, 2);

  const messages = [
    { role: "system", content: buildSystemPrompt(context) },
    ...history,
  ];

  const reply = await callOpenRouter(messages);
  if (reply) history.push({ role: "assistant", content: reply });
  return reply;
}

// ── Log to Supabase ───────────────────────────────────────────────────────────
async function logMessage(shopId, senderJid, messageText, replySent, replyType) {
  try {
    await supabase.from("messages").insert({
      shop_id: shopId, sender_jid: senderJid,
      message_text: messageText, reply_sent: replySent, reply_type: replyType,
    });
  } catch (err) { console.error(`Log error:`, err.message); }
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function handleIncomingMessage(shopId, senderJid, text, waSocket) {
  try {
    const { data: shop } = await supabase
      .from("shops").select("auto_reply").eq("id", shopId).single();

    if (!shop?.auto_reply) { await logMessage(shopId, senderJid, text, null, "none"); return; }

    let reply = null;
    let replyType = "none";

    // 1. Keyword match
    reply = await keywordMatch(shopId, text);
    if (reply) { replyType = "keyword"; console.log(`[${shopId}] ✓ Keyword`); }

    // 2. RAG AI
    if (!reply) {
      try {
        reply = await aiReply(shopId, senderJid, text);
        if (reply) replyType = "ai";
      } catch (err) { console.error(`[${shopId}] AI error:`, err.message); }
    }

    // 3. Send
    if (reply) {
      await waSocket.sendMessage(senderJid, { text: reply });
      console.log(`[${shopId}] → Sent (${replyType})`);
    }

    await logMessage(shopId, senderJid, text, reply, replyType);
  } catch (err) { console.error(`[${shopId}] Error:`, err.message); }
}

module.exports = { handleIncomingMessage };
