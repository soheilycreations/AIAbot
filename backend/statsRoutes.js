/**
 * statsRoutes.js
 * Dashboard statistics API
 */

const express = require("express");
const router = express.Router();
const supabase = require("./supabaseClient");

// GET /api/stats/:shopId
router.get("/:shopId", async (req, res) => {
  const { shopId } = req.params;

  try {
    // Today's messages
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count: todayCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .gte("created_at", todayStart.toISOString());

    // This week's messages
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const { count: weekCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .gte("created_at", weekStart.toISOString());

    // Active customers (unique senders last 7 days)
    const { data: uniqueSenders } = await supabase
      .from("messages")
      .select("sender_jid")
      .eq("shop_id", shopId)
      .gte("created_at", weekStart.toISOString());

    const activeCustomers = new Set(uniqueSenders?.map(m => m.sender_jid) || []).size;

    // Reply rate % (messages with replies / total messages)
    const { count: totalMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    const { count: repliedMessages } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .not("reply_sent", "is", null);

    const replyRate = totalMessages > 0 
      ? Math.round((repliedMessages / totalMessages) * 100)
      : 0;

    // Most asked questions (top 5 by frequency)
    const { data: allMessages } = await supabase
      .from("messages")
      .select("message_text")
      .eq("shop_id", shopId)
      .limit(500);

    // Simple word frequency analysis
    const questionWords = {};
    allMessages?.forEach(m => {
      const words = m.message_text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          questionWords[word] = (questionWords[word] || 0) + 1;
        }
      });
    });

    const topQuestions = Object.entries(questionWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    res.json({
      today_messages: todayCount || 0,
      week_messages: weekCount || 0,
      active_customers: activeCustomers,
      reply_rate: replyRate,
      top_questions: topQuestions,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
