/**
 * replyEngine.js — RAG-Powered Reply Engine
 * Uses pgvector similarity search for accurate context retrieval
 * Dynamically loads system instructions from shop PDFs
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

// ── AI Reply Generation (RAG + History + Dynamic PDF Rules) ─────────────────
async function aiReply(shopId, senderJid, userMessage) {
  if (!process.env.GEMINI_API_KEY) return null;

  // 1. Conversation History Setup
  if (!conversationHistory.has(senderJid)) conversationHistory.set(senderJid, []);
  const history = conversationHistory.get(senderJid);

  // 2. PDF eken adala business knowledge chunks tika gannawa
  let businessContext = await retrieveRelevantChunks(shopId, userMessage, 4);
  if (!businessContext) businessContext = await getFallbackContext(shopId);

  // 3. 🌟 PDF eken dynamic instructions / custom rules wenama adala gannawa
  const { data: ruleDocs } = await supabase
    .from("knowledge_docs")
    .select("content")
    .eq("shop_id", shopId)
    .or("file_name.ilike.%instruction%,file_name.ilike.%rule%");

  let dynamicInstructions = "";
  if (ruleDocs && ruleDocs.length > 0) {
    dynamicInstructions = ruleDocs.map(d => d.content).join("\n\n");
    console.log(`[${shopId}] ✓ Dynamic instructions loaded from PDF`);
  } else {
    // Default system instructions (Fallback eka) rules mukuth nathi shop walata
    dynamicInstructions = `
You are an advanced, empathetic, and highly trained AI Customer Service Assistant. 
Your behavior, business logic, rules, and knowledge are entirely driven by the provided "Business Knowledge Context".

CRITICAL OPERATIONAL RULES:
1. DYNAMIC LANGUAGE MATCHING:
   - If the customer writes in "Singlish" (Sinhala in English letters, e.g., "koheda thiyenne"), reply ONLY in polite, friendly Singlish using appropriate emojis (😊, ✨, 👍).
   - If the customer writes in "Sinhala script" (සිංහල), reply ONLY in professional and warm Sinhala.
   - If the customer writes in "English", reply ONLY in professional, fluent English.

2. CONSULTATIVE CHATTING (NEEDS ASSESSMENT):
   - Do NOT just dump all information at once. Chat conversationally.
   - Ask clarifying questions to understand the customer's exact needs or problems so they realize the value of the product/service themselves.

3. TRUTHFULNESS & STRICT LIMITS:
   - Use ONLY real data, prices, numbers, and policies explicitly mentioned in the "Business Knowledge Context".
   - Do NOT hallucinate, invent, or guess any details.

4. HUMAN AGENT HANDOFF (THE ESCALATION RULE):
   - If the customer asks a question that is NOT available in the context (unknown knowledge), or if they express frustration, politely tell them that you don't have that specific detail right now and ask: "Mage knowledge base eke e gana wisthara thama na. Puluwan nam ape Customer Care Agent kenekwa oyaata sambanda karala dhennada? 😊"
   - Do NOT show this agent handoff option on every normal reply—ONLY when you don't know the answer or when the conversation reaches a natural closing/buying point.`;
  }

  // 4. History text eka build karagannawa
  const historyText = history.map(h => `${h.role === 'user' ? 'Customer' : 'Bot'}: ${h.parts}`).join("\n");

  // 5. Final Prompt eka Gemini ekata yavana widihata hadagannawa
  const finalPrompt = `
You are an advanced AI Customer Service Assistant. Your behavior, voice, and operation rules are strictly defined by the "OPERATIONAL SYSTEM RULES" below.

[OPERATIONAL SYSTEM RULES (LOADED FROM SHOP PDF)]
${dynamicInstructions}

[BUSINESS KNOWLEDGE CONTEXT]
${businessContext || "No business details available."}

[CONVERSATION HISTORY]
${historyText}

[CURRENT INPUT]
Customer: ${userMessage}
Bot:`;

  // 6. Gemini API call eka (v1beta endpoint)
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: finalPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
      },
    },
    { timeout: 15000 }
  );

  const botReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (botReply) {
    history.push({ role: "user", parts: userMessage });
    history.push({ role: "model", parts: botReply });
    if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
  }

  return botReply || null;
}

// ── Log Message to Database ──────────────────────────────────────────────────
async function logMessage(shopId, senderJid, messageText, replySent, replyType) {
  try {
    await supabase.from("messages").insert({
      shop_id: shopId,
      sender_jid: senderJid,
      message_text: messageText,
      reply_sent: replySent,
      reply_type: replyType,
    });
  } catch (err) { console.error(`Log error:`, err.message); }
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function handleIncomingMessage(shopId, senderJid, text, waSocket) {
  try {
    const { data: shop } = await supabase
      .from("shops").select("auto_reply").eq("id", shopId).single();

    if (!shop?.auto_reply) { 
      await logMessage(shopId, senderJid, text, null, "none"); 
      return; 
    }

    let reply = null;
    let replyType = "none";

    // 1. Keyword match
    reply = await keywordMatch(shopId, text);
    if (reply) { 
      replyType = "keyword"; 
      console.log(`[${shopId}] ✓ Keyword`); 
    }

    // 2. RAG AI
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
