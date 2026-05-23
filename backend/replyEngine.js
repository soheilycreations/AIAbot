/**
 * replyEngine.js — RAG-Powered Reply Engine (OpenRouter Fixed Version)
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
    docs.forEach(doc => { context += `### ${doc.file_name}\n${doc.content}\n\n`; });
  }
  if (faqs?.length) {
    context += "## Frequently Asked Questions\n";
    faqs.forEach(f => { context += `Q: ${f.question}\nA: ${f.answer}\n\n`; });
  }
  return context.trim() || null;
}

// ── AI Reply Generation (RAG + History) ───────────────────────────────────────
async function aiReply(shopId, senderJid, userMessage) {
  // 🌟 NOTE: ඔයා Railway එකේ OpenRouter key එක දාලා තියෙන Variable Name එක මෙතනට දෙන්න (e.g., OPENROUTER_API_KEY හෝ GEMINI_API_KEY)
  const apiKey = (process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  
  if (!apiKey) {
    console.error(`[${shopId}] OpenRouter API key is missing in Environment Variables!`);
    return null;
  }

  if (!conversationHistory.has(senderJid)) conversationHistory.set(senderJid, []);
  const history = conversationHistory.get(senderJid);

  let businessContext = await retrieveRelevantChunks(shopId, userMessage, 4);
  if (!businessContext) businessContext = await getFallbackContext(shopId);

  const systemInstructions = `
You are an advanced, empathetic, and highly trained AI Customer Service Assistant. 
Your behavior, business logic, rules, and knowledge are entirely driven by the provided "Business Knowledge Context".

CRITICAL OPERATIONAL RULES:
1. DYNAMIC LANGUAGE MATCHING:
   - If the customer writes in "Singlish" (Sinhala in English letters, e.g., "koheda thiyenne"), reply ONLY in polite, friendly Singlish using appropriate emojis (😊, ✨, 👍).
   - If the customer writes in "Sinhala script" (සිංහල), reply ONLY in professional and warm Sinhala.
   - If the customer writes in "English", reply ONLY in professional, fluent English.

2. TRUTHFULNESS & STRICT LIMITS:
   - Use ONLY real data, prices, numbers, and policies explicitly mentioned in the "Business Knowledge Context".
   - Do NOT hallucinate or guess any details.

3. HUMAN AGENT HANDOFF:
   - If the customer asks a question that is NOT available in the context, politely ask: "Mage knowledge base eke e gana wisthara thama na. Puluwan nam ape Customer Care Agent kenekwa oyaata sambanda karala dhennada? 😊"`;

  const historyText = history.map(h => `${h.role === 'user' ? 'Customer' : 'Bot'}: ${h.parts}`).join("\n");

  const finalPrompt = `
${systemInstructions}

[BUSINESS KNOWLEDGE CONTEXT]
${businessContext || "No business details available."}

[CONVERSATION HISTORY]
${historyText}

[CURRENT INPUT]
Customer: ${userMessage}
Bot:`;

  // ── OpenRouter API Call (Fixed URL & Parsing) ──────────────────────────────
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-1.5-flash", 
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.3,
        max_tokens: 600,
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aiabot-frontend-production.up.railway.app",
          "X-Title": "WhatsApp Bot Platform"
        },
        timeout: 15000
      }
    );

    const botReply = response.data?.choices?.[0]?.message?.content?.trim();

    if (botReply) {
      history.push({ role: "user", parts: userMessage });
      history.push({ role: "model", parts: botReply });
      if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
    }

    return botReply || null;

  } catch (err) {
    console.error(`[${shopId}] OpenRouter API Error:`, err.response?.data || err.message);
    return null;
  }
}

// ── Log Message to Database ──────────────────────────────────────────────────
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

    // 2. RAG AI (OpenRouter)
    if (!reply) {
      try {
        reply = await aiReply(shopId, senderJid, text);
        if (reply) replyType = "ai";
      } catch (err) { console.error(`[${shopId}] AI error:`, err.message); }
    }

    // 3. Send Message
    if (reply) {
      await waSocket.sendMessage(senderJid, { text: reply });
      await logMessage(shopId, senderJid, text, reply, replyType);
      console.log(`[${shopId}] → Reply sent to ${senderJid} (${replyType})`);
    } else {
      await logMessage(shopId, senderJid, text, null, "none");
    }

  } catch (err) {
    console.error(`[${shopId}] Error handling incoming message:`, err.message);
  }
}

module.exports = { handleIncomingMessage };
