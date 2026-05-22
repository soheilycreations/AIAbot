/**
 * docRoutes.js
 * Handles file upload, text extraction, and knowledge doc management.
 * Supports: PDF, Excel (.xlsx/.xls), Word (.docx), CSV, TXT
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const supabase = require("./supabaseClient");

// ── File parsers ──────────────────────────────────────────────────────────────
const pdfParse   = require("pdf-parse");
const mammoth    = require("mammoth");
const XLSX       = require("xlsx");

// Store file in memory (no disk needed on Render)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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

// ── Text extractors ───────────────────────────────────────────────────────────

async function extractText(buffer, mimetype, filename) {
  const ext = filename.split(".").pop().toLowerCase();

  // PDF
  if (mimetype === "application/pdf" || ext === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  // Word (.docx)
  if (mimetype.includes("wordprocessingml") || ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Excel (.xlsx / .xls)
  if (mimetype.includes("spreadsheetml") || mimetype.includes("ms-excel") || ["xlsx", "xls"].includes(ext)) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += `\n--- Sheet: ${sheetName} ---\n${csv}`;
    });
    return text;
  }

  // CSV / TXT
  return buffer.toString("utf-8");
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/docs/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) return res.status(400).json({ error: "shopId required" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { originalname, mimetype, buffer } = req.file;

    // Extract text from file
    const content = await extractText(buffer, mimetype, originalname);

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: "Could not extract text from file" });
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from("knowledge_docs")
      .insert({
        shop_id: shopId,
        file_name: originalname,
        file_type: mimetype,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
      success: true,
      doc: {
        id: data.id,
        file_name: data.file_name,
        content_length: data.content.length,
        created_at: data.created_at,
      },
    });
  } catch (err) {
    console.error("Upload error:", err.message);
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

  // Return preview only (first 200 chars) to keep response small
  const docs = data.map((d) => ({
    ...d,
    preview: d.content.slice(0, 200) + "...",
    content_length: d.content.length,
    content: undefined,
  }));

  res.json(docs);
});

// DELETE /api/docs/:id
router.delete("/:id", async (req, res) => {
  const { error } = await supabase
    .from("knowledge_docs")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
