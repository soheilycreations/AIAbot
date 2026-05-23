/**
 * docRoutes.js — File upload + RAG processing
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const supabase = require("./supabaseClient");
const { processDocument } = require("./ragProcessor");

const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|xlsx|xls|csv|txt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

async function extractText(buffer, mimetype, filename) {
  const ext = filename.split(".").pop().toLowerCase();

  if (mimetype === "application/pdf" || ext === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (mimetype.includes("wordprocessingml") || ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimetype.includes("spreadsheetml") || mimetype.includes("ms-excel") || ["xlsx", "xls"].includes(ext)) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      text += `\n--- Sheet: ${sheetName} ---\n${XLSX.utils.sheet_to_csv(sheet)}`;
    });
    return text;
  }
  return buffer.toString("utf-8");
}

// POST /api/docs/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) return res.status(400).json({ error: "shopId required" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { originalname, mimetype, buffer } = req.file;
    const content = await extractText(buffer, mimetype, originalname);

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: "Could not extract text from file" });
    }

    // Save to knowledge_docs
    // 🔄 Save to knowledge_docs (Fixed Supabase Syntax)
    const { data: insertedRows, error } = await supabase
      .from("knowledge_docs")
      .insert({ 
        shop_id: shopId, 
        file_name: originalname, 
        file_type: mimetype, 
        content: content.trim() 
      })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!insertedRows || insertedRows.length === 0) {
      return res.status(500).json({ error: "Failed to insert document" });
    }

    const data = insertedRows[0]; // Get the first inserted record
    if (error) return res.status(500).json({ error: error.message });

    // Process embeddings in background (don't wait)
    if (process.env.GEMINI_API_KEY) {
      processDocument(shopId, data.id, content.trim())
        .then(result => console.log(`[RAG] Embedded: ${result.processed}/${result.total} chunks`))
        .catch(err => console.error(`[RAG] Embed error:`, err.message));
    }

    res.status(201).json({
      success: true,
      doc: {
        id: data.id,
        file_name: data.file_name,
        content_length: data.content.length,
        created_at: data.created_at,
        rag_enabled: !!process.env.GEMINI_API_KEY,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/docs?shopId=shop_123
router.get("/", async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ error: "shopId required" });

  const { data, error } = await supabase
    .from("knowledge_docs")
    .select("id, file_name, file_type, created_at, content")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data.map(d => ({
    ...d,
    preview: d.content.slice(0, 200) + "...",
    content_length: d.content.length,
    content: undefined,
  })));
});

// DELETE /api/docs/:id
router.delete("/:id", async (req, res) => {
  // Delete embeddings first
  await supabase.from("doc_embeddings").delete().eq("doc_id", req.params.id);
  // Delete document
  const { error } = await supabase.from("knowledge_docs").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/docs/reprocess - Re-embed all docs
router.post("/reprocess", async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.status(400).json({ error: "shopId required" });
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: "GEMINI_API_KEY not set" });

  const { processAllDocuments } = require("./ragProcessor");
  processAllDocuments(shopId)
    .then(() => console.log(`[RAG] Reprocessed all docs for ${shopId}`))
    .catch(err => console.error(`[RAG] Reprocess error:`, err.message));

  res.json({ success: true, message: "Reprocessing started in background" });
});

module.exports = router;
