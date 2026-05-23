/**
 * replyEngine.js — RAG-Powered Reply Engine (OpenRouter Safe Version)
 * Uses pgvector similarity search for accurate context retrieval
 * Dynamically loads system instructions safely from shop PDFs
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
  const apiKey = process.env.GEMINI_API_KEY?.trim(); 
  if (!apiKey) {
    console.error(`[${shopId}] OpenRouter API key is missing!`);
    return null;
  }

  if (!conversationHistory.has(senderJid)) conversationHistory.set(senderJid, []);
  const history = conversationHistory.get(senderJid);

  let businessContext = await retrieveRelevantChunks(shopId, userMessage, 4);
  if (!businessContext) businessContext = await getFallbackContext(shopId);

  const { data: ruleDocs } = await supabase
    .from("knowledge_docs")
    .select("content")
    .eq("shop_id", shopId)
    .or("file_name.ilike.%instruction%,file_name.ilike.%rule%");

  let dynamicInstructions = "";
  
  // 🌟 FIX: Array එකක්මද කියලා ෂුවර් කරගෙන (Array.isArray) map එක run කරනවා. නැත්නම් Crash වෙන්නේ නෑ.
  if (Array.isArray(ruleDocs) && ruleDocs.length > 0) {
    dynamicInstructions = ruleDocs.map(d => d.content).join("\n\n");
    console.log(`[${shopId}] ✓ Dynamic instructions loaded from PDF`);
  } else {
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
   - Ask clarifying questions to understand the customer's exact needs or problems.

3. TRUTHFULNESS & STRICT LIMITS:
   - Use ONLY real data, prices, numbers, and policies explicitly mentioned in the "Business Knowledge Context".
   - Do NOT hallucinate or guess any details.

4. HUMAN AGENT HANDOFF:
   - If the customer asks a question that is NOT available in the context, politely ask: "Mage knowledge base eke e gana wisthara thama na. Puluwan nam ape Customer Care Agent kenekwa oyaata sambanda karala dhennada? 😊"`;
