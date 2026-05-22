-- ================================================================
-- WhatsApp Bot Platform — Supabase Schema
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Shops table
CREATE TABLE IF NOT EXISTS shops (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  auto_reply  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default shop for PoC
INSERT INTO shops (id, name) VALUES ('shop_123', 'My Shop')
ON CONFLICT (id) DO NOTHING;

-- 2. FAQs / Knowledge Base table
CREATE TABLE IF NOT EXISTS faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     TEXT REFERENCES shops(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  keywords    TEXT[] DEFAULT '{}',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Messages table (incoming WhatsApp messages)
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       TEXT REFERENCES shops(id) ON DELETE CASCADE,
  sender_jid    TEXT NOT NULL,
  sender_name   TEXT,
  message_text  TEXT NOT NULL,
  reply_sent    TEXT,
  reply_type    TEXT CHECK (reply_type IN ('keyword', 'ai', 'none')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index for faster queries
CREATE INDEX IF NOT EXISTS idx_faqs_shop_id ON faqs(shop_id);
CREATE INDEX IF NOT EXISTS idx_messages_shop_id ON messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- 5. Sample FAQs
INSERT INTO faqs (shop_id, question, answer, keywords) VALUES
('shop_123', 'What are your opening hours?', 'We are open Monday to Saturday, 9AM to 6PM.', ARRAY['hours', 'open', 'time', 'opening']),
('shop_123', 'How can I place an order?', 'You can place an order by messaging us here on WhatsApp or visiting our store.', ARRAY['order', 'buy', 'purchase']),
('shop_123', 'Do you offer delivery?', 'Yes! We offer delivery within Colombo. Delivery charge is Rs. 200.', ARRAY['delivery', 'deliver', 'shipping', 'ship']);
