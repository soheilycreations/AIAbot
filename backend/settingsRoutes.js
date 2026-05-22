/**
 * settingsRoutes.js
 * Shop settings management API
 */

const express = require("express");
const router = express.Router();
const supabase = require("./supabaseClient");
const bcrypt = require("bcrypt");

// GET /api/settings/:shopId
router.get("/:shopId", async (req, res) => {
  const { shopId } = req.params;

  const { data, error } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("shop_id", shopId)
    .single();

  if (error && error.code !== "PGRST116") {
    return res.status(500).json({ error: error.message });
  }

  // Return default if not found
  if (!data) {
    return res.json({
      shop_id: shopId,
      shop_name: "",
      location: "",
      address: "",
      working_hours: "",
      contact_numbers: [],
      language: "sinhala",
    });
  }

  res.json(data);
});

// PATCH /api/settings/:shopId
router.patch("/:shopId", async (req, res) => {
  const { shopId } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.shop_id;

  const { data, error } = await supabase
    .from("shop_settings")
    .upsert({ shop_id: shopId, ...updates })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/settings/:shopId/password
router.post("/:shopId/password", async (req, res) => {
  const { shopId } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  // Get current password hash
  const { data: shop } = await supabase
    .from("shops")
    .select("password_hash")
    .eq("id", shopId)
    .single();

  // Verify current password if exists
  if (shop?.password_hash) {
    const valid = await bcrypt.compare(currentPassword || "", shop.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
  }

  // Hash new password
  const hash = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from("shops")
    .update({ password_hash: hash })
    .eq("id", shopId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
