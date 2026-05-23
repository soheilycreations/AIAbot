/**
 * replyEngine.js — Ultimate Production-Grade Multi-Tenant Reply Engine
 * Audited & Hardened against memory leaks, duplicate webhooks, cost inflation, and architectural smells.
 */

const axios = require("axios");
const crypto = require("crypto"); // Built-in Node.js module for de-duplication hashing
const supabase = require("./supabaseClient");
const { retrieveRelevantChunks } = require("./ragProcessor");

// ── 1. In-Memory Storages & Rate Limiting ────────────────────────────────────
const conversationHistory = new Map(); // Stores object: { messages: [], lastUsed: timestamp }
const lastReplyTime = new Map();       // Stores timestamp per historyKey
const processedMessageHashes = new Map(); // De-duplication cache (hash -> timestamp)

const MAX_HISTORY = 8;
const CACHE_TTL = 5 * 60 * 1000;       // විනාඩි 5ක Cache TTL එකක්

// ── 2. Memory Leak Cleanup Loop (Runs every 10 mins) ─────────────────────────
setInterval(() => {
  const now = Date.now();
  
  // Conversation History & Rate Limit Cleanup
  for (const [key, session] of conversationHistory.entries()) {
    if (session.lastUsed && now - session.lastUsed > 30 * 60 * 1000) {
      conversationHistory.delete(key);
      lastReplyTime.delete(key);
    }
  }

  // FAQ Cache Cleanup (Deletes shops inactive for more than 15 mins)
  for (const [shopId, cached] of faqCache.entries()) {
    if (now - cached.cachedAt > CACHE_TTL * 3) {
      faqCache.delete(shopId);
    }
  }

  // WhatsApp Duplicate Message Hashes Cleanup (Older than 10 seconds)
  for (const [hash, timestamp] of processedMessageHashes.entries()) {
    if (now - timestamp > 10 * 1000) {
      processedMessageHashes.delete(hash);
    }
  }
}, 10 * 60 * 1000);

// ── 3. Optimized In-Memory Cache for FAQs ────────────────────────────────────
const faqCache = new Map();

async function getCachedFaqs(shopId) {
  const now = Date.now();
  const cached = faqCache.get(shopId);

  if (cached && (now - cached.cachedAt < CACHE_TTL)) {
    return cached.data;
  }

  const { data: faqs } = await supabase
    .from("faqs")
    .select("question, answer, keywords")
    .eq("shop_id", shopId)
    .eq("is_active", true);

  faqCache.set(shopId, { data: faqs || [], cachedAt: now });
  return faqs || [];
}

// ── 4. Language Heuristics ───────────────────────────────────────────────────
function detectLanguage(text) {
  if (/[\u0D80-\u0DFF]/.test(text)) return "Sinhala Script (සිංහල)";
  
  const commonSinglish = /\b(koheda|thiyenne|kiyakda|ganan|moka|ne|neda|mchan|machan|puluwanda|awul|ela|supiri|wisthara|gana)\b/i;
  if (commonSinglish.test(text)) return "Singlish (Sinhala text written in English alphabet)";
  if (/[a-z]/i.test(text)) return "English";
  
  return "Unknown / Mixed";
}

// ── 5. Keyword Match (Strict Word-Level Matching) ───────────────────────────
async function keywordMatch(shopId, text) {
  const faqs = await getCachedFaqs(shopId);
  if (!faqs?.length) return null;
  
  const normalizedLower = text.toLowerCase().replace(/\s+/g, " ").trim();
  const words = normalizedLower.split(" ");

  for (const faq of faqs) {
    if (faq.keywords && Array.isArray(faq.keywords)) {
      const hasMatch = faq.keywords.some(kw => {
        const cleanKw = kw.toLowerCase().replace(/\s+/g, " ").trim();
        return cleanKw.includes(" ") ? normalizedLower.includes(cleanKw) : words.includes(cleanKw);
      });
      if (hasMatch) return faq.answer;
    }

    if (normalizedLower.includes(faq.question.toLowerCase().replace(/\s+/g, " ").trim())) {
      return faq.answer;
    }
  }
  return null;
}

// ── 6. Fallback Context Builder ───────────────────────────────────────────────
async function getFallbackContext(shopId) {
  const faqs = await getCachedFaqs(shopId);
  const { data: docs } = await supabase
    .from("knowledge_docs")
    .select("file_name, content")
    .eq("shop_id", shopId);

  let context = "";
  // Priority Layout Strategy: Core Docs first, then FAQs
  if (docs?.length) {
    context += "## Core Business Rules & Knowledge Documents\n";
    docs.forEach(doc => { context += `### ${doc.file_name}\n${doc.content}\n\n`; });
  }
  if (faqs?.length) {
    context += "## Frequently Asked Questions Reference\n";
    faqs.forEach(f => { context += `Q: ${f.question}\nA: ${f.answer}\n\n`; });
  }

  return context.trim() ? context.substring(0, 7000) : null;
}

// ── 7. AI Reply Core Logic (OpenRouter + Fallback Model Strategy) ─────────────
async function callOpenRouterWithFallback(messagesPayload, apiKey) {
  // Model Fallback Strategy: Gemini ප්‍රධාන වශයෙන්ම වැඩ කරනවා, අවුලක් ගියොත් gpt-4o-mini එකට ස්විච් වෙනවා
  const models = ["google/gemini-1.5-flash", "openai/gpt-4o-mini"];
  
  for (const model of models) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: model, 
          messages: messagesPayload,
          temperature: 0.3,
          max_tokens: 500,
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aiabot-platform.com",
            "X-Title": "WhatsApp AI Engine Pro"
          },
          timeout: 12000
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;

    } catch (err) {
      console.error(`[AI Engine] Model ${model} failed execution:`, err.response?.data ? JSON.stringify(err.response.data) : err.message);
      if (err.response?.status === 401) break; // Invalid API Key නම් ලූප් එක නවත්වනවා
    }
  }
  return null;
}

// ── 8. AI Orchestration ───────────────────────────────────────────────────────
async function aiReply(shopId, senderJid, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(`[${shopId}] API configuration missing!`);
    return null;
  }

  const historyKey = `${shopId}:${senderJid}`;
  const now = Date.now();

  // Cost & Spam Guard: 3s rate-limiting
  if (now - (lastReplyTime.get(historyKey) || 0) < 3000) {
    console.warn(`[${shopId}] Rate limit triggered for: ${senderJid}`);
    return null;
  }
  lastReplyTime.set(historyKey, now);

  // Structural Bug Fix: Array prop එකක් වෙනුවට Clean Session Object එකක් හදනවා
  if (!conversationHistory.has(historyKey)) {
    conversationHistory.set(historyKey, { messages: [], lastUsed: now });
  }
  const session = conversationHistory.get(historyKey);
  session.lastUsed = now; // TTL Keep-alive update
  const history = session.messages;

  let businessContext = await retrieveRelevantChunks(shopId, userMessage, 4);
  if (!businessContext) businessContext = await getFallbackContext(shopId);

  const userLang = detectLanguage(userMessage);

  const systemInstructions = `You are an advanced, empathetic, and highly trained AI Customer Service Assistant.
Your behavior, business logic, rules, and knowledge are entirely driven by the provided "Business Knowledge Context".

CRITICAL OPERATIONAL RULES:
1. DETECTED CUSTOMER LANGUAGE:
   - The user is currently writing in: ${userLang}.
   - If userLang is Singlish, reply ONLY in polite, friendly Singlish using appropriate emojis (😊, ✨, 👍).
   - If userLang is Sinhala script (සිංහල), reply ONLY in professional and warm Sinhala script.
   - If userLang is English, reply ONLY in professional, fluent English.

2. TRUTHFULNESS & STRICT LIMITS:
   - Use ONLY real data, prices, numbers, and policies explicitly mentioned in the "Business Knowledge Context".
   - Do NOT hallucinate or guess any details.

3. HUMAN AGENT HANDOFF:
   - If the customer asks something NOT available in the context, politely inform them that you will transfer this message to a live staff member. Do this in their matching language format.

[BUSINESS KNOWLEDGE CONTEXT]
${businessContext || "No knowledge base configured."}`;

  const formattedHistory = history.map(h => ({
    role: h.role === "user" ? "user" : "assistant",
    content: h.parts
  }));

  const messagesPayload = [
    { role: "system", content: systemInstructions },
    ...formattedHistory,
    { role: "user", content: userMessage }
  ];

  const botReply = await callOpenRouterWithFallback(messagesPayload, apiKey);

  if (botReply) {
    history.push({ role: "user", parts: userMessage });
    history.push({ role: "model", parts: botReply });
    if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
  }

  return botReply;
}

// ── 9. Database Logger ───────────────────────────────────────────────────────
async function logMessage(shopId, senderJid, messageText, replySent, replyType) {
  try {
    await supabase.from("messages").insert({
      shop_id: shopId, 
      sender_jid: senderJid,
      message_text: messageText, 
      reply_sent: !!replySent,
      reply_text: replySent || null, 
      reply_type: replyType,
    });
  } catch (err) { 
    console.error(`Log error:`, err.message); 
  }
}

// ── 10. Main Webhook Message Handler ─────────────────────────────────────────
async function handleIncomingMessage(shopId, senderJid, text, waSocket) {
  try {
    // 🌟 WhatsApp De-duplication Guard (Sha1 Hash Check)
    const normalizedText = text.toLowerCase().trim();
    const msgHash = crypto
      .createHash("sha1")
      .update(`${shopId}:${senderJid}:${normalizedText}`)
      .digest("hex");

    if (processedMessageHashes.has(msgHash)) {
      console.log(`[${shopId}] Ignored duplicate WhatsApp webhook event for hash: ${msgHash}`);
      return; // Ignore duplicate network retries silently
    }
    processedMessageHashes.set(msgHash, Date.now());

    const { data: shop } = await supabase
      .from("shops").select("auto_reply").eq("id", shopId).single();

    if (!shop?.auto_reply) { 
      await logMessage(shopId, senderJid, text, null, "none"); 
      return; 
    }

    let reply = null;
    let replyType = "none";

    // Step 1: Keyword Lookup
    reply = await keywordMatch(shopId, text);
    if (reply) replyType = "keyword";

    const hasValidKeywordReply = typeof reply === "string" && reply.trim().length > 0;

    // Step 2: AI Execution
    if (!hasValidKeywordReply) {
      try {
        reply = await aiReply(shopId, senderJid, text);
        if (reply) replyType = "ai";
      } catch (err) { 
        console.error(`[${shopId}] AI Execution error:`, err.message); 
      }
    }

    // Step 3: Send Response
    if (typeof reply === "string" && reply.trim().length > 0) {
      await waSocket.sendMessage(senderJid, { text: reply });
      await logMessage(shopId, senderJid, text, reply, replyType);
      console.log(`[${shopId}] → Dispatched (${replyType}) to ${senderJid}`);
    } else {
      await logMessage(shopId, senderJid, text, null, "none");
    }

  } catch (err) {
    console.error(`[${shopId}] Critical Crash Intercepted:`, err.message);
  }
}

module.exports = { handleIncomingMessage };
