/**
 * authRoutes.js
 * Simple password verification
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const supabase = require("./supabaseClient");

// POST /api/auth/verify
router.post("/verify", async (req, res) => {
  const { shopId, password } = req.body;

  if (!shopId || !password) {
    return res.status(400).json({ error: "shopId and password required" });
  }

  try {
    const { data: shop } = await supabase
      .from("shops")
      .select("password_hash")
      .eq("id", shopId)
      .single();

    if (!shop?.password_hash) {
      return res.status(401).json({ error: "Password not set" });
    }

    const valid = await bcrypt.compare(password, shop.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.json({ success: true, token: Buffer.from(password).toString("base64") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
