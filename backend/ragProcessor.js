/**
 * ragProcessor.js
 * Chunks documents and generates embeddings using Gemini API
 * Saves vectors to Supabase doc_embeddings table
 */

const axios = require("axios");
const supabase = require("./supabaseClient");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CHUNK_SIZE = 500;       // characters per chunk
const CHUNK_OVERLAP = 50;     // overlap between chunks

// ── Text Chunker ──────────────────────────────────────────────────────────────
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  // Clean text
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < cleaned.length) {
      const breakPoints = [". ", ".\n", "! ", "? ", "\n\n", "\n"];
      for (const bp of breakPoints) {
        const idx = cleaned.lastIndexOf(bp, end);
        if (idx > start + chunkSize * 0.5) {
          end = idx + bp.length;
          break;
        }
      }
    }

    const chunk = cleaned.slice(start, Math.min(end, cleaned.length)).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    start = end - overlap;
  }

  return chunks;
}

// ── Generate Embedding (Gemini) ───────────────────────────────────────────────
async function generateEmbedding(text) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      model: "models/text-embedding-004",
      content: {
        parts: [{ text }],
      },
      taskType: "RETRIEVAL_DOCUMENT",
    },
    { timeout: 15000 }
  );

  const embedding = response.data?.embedding?.values;
  if (!embedding || embedding.length === 0) {
    throw new Error("Empty embedding returned");
  }

  return embedding; // 768 dimensions
}

// ── Process Document ──────────────────────────────────────────────────────────
async function processDocument(shopId, docId, content) {
  console.log(`[RAG] Processing document ${docId} for shop ${shopId}`);

  // Delete existing embeddings for this doc
  await supabase
    .from("doc_embeddings")
    .delete()
    .eq("doc_id", docId);

  // Chunk the text
  const chunks = chunkText(content);
  console.log(`[RAG] Created ${chunks.length} chunks`);

  let processed = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      // Generate embedding
      const embedding = await generateEmbedding(chunk);

      // Save to Supabase
      const { error } = await supabase
        .from("doc_embeddings")
        .insert({
          shop_id: shopId,
          doc_id: docId,
          content: chunk,
          embedding: JSON.stringify(embedding),
        });

      if (error) {
        console.error(`[RAG] DB insert error:`, error.message);
        errors.push(error.message);
      } else {
        processed++;
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`[RAG] Embedding error for chunk:`, err.message);
      errors.push(err.message);
    }
  }

  console.log(`[RAG] ✓ Processed ${processed}/${chunks.length} chunks`);
  return { processed, total: chunks.length, errors };
}

// ── Process All Docs for a Shop ───────────────────────────────────────────────
async function processAllDocuments(shopId) {
  const { data: docs, error } = await supabase
    .from("knowledge_docs")
    .select("id, file_name, content")
    .eq("shop_id", shopId);

  if (error || !docs?.length) {
    console.log(`[RAG] No documents found for shop ${shopId}`);
    return;
  }

  for (const doc of docs) {
    console.log(`[RAG] Processing: ${doc.file_name}`);
    await processDocument(shopId, doc.id, doc.content);
  }

  console.log(`[RAG] ✓ All documents processed for shop ${shopId}`);
}

// ── Query Embedding ───────────────────────────────────────────────────────────
async function generateQueryEmbedding(text) {
  if (!GEMINI_API_KEY) return null;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      model: "models/text-embedding-004",
      content: {
        parts: [{ text }],
      },
      taskType: "RETRIEVAL_QUERY",
    },
    { timeout: 10000 }
  );

  return response.data?.embedding?.values;
}

// ── Retrieve Relevant Chunks ──────────────────────────────────────────────────
async function retrieveRelevantChunks(shopId, query, topK = 5) {
  try {
    const queryEmbedding = await generateQueryEmbedding(query);
    if (!queryEmbedding) return null;

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_shop_id: shopId,
      match_count: topK,
      match_threshold: 0.4,
    });

    if (error) {
      console.error(`[RAG] RPC error:`, error.message);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`[RAG] No relevant chunks found`);
      return null;
    }

    console.log(`[RAG] Found ${data.length} relevant chunks`);
    return data.map(d => d.content).join("\n\n---\n\n");

  } catch (err) {
    console.error(`[RAG] Retrieve error:`, err.message);
    return null;
  }
}

module.exports = {
  processDocument,
  processAllDocuments,
  retrieveRelevantChunks,
  chunkText,
};
