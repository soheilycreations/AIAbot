/**
 * faqRoutes.js
 * REST API endpoints for FAQ / Knowledge Base management.
 */

const express = require("express");
const router = express.Router();
const supabase = require("./supabaseClient");

// GET /api/faqs?shopId=shop_123
router.get("/", async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ error: "shopId required" });

  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/faqs
router.post("/", async (req, res) => {
  const { shop_id, question, answer, keywords } = req.body;
  if (!shop_id || !question || !answer)
    return res.status(400).json({ error: "shop_id, question, answer required" });

  const { data, error } = await supabase
    .from("faqs")
    .insert({ shop_id, question, answer, keywords: keywords || [] })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/faqs/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates.id;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("faqs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/faqs/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
