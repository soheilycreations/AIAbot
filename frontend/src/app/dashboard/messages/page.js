"use client";

import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Bot, Zap } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const SHOP_ID = "shop_123";

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages?shopId=${SHOP_ID}&limit=50`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Messages fetch error:", err);
      setMessages([]);
    }
    setLoading(false);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleString("en-LK", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function shortJid(jid) {
    return jid?.replace("@s.whatsapp.net", "").replace("@lid", "") || jid;
  }

  const replyBadge = {
    keyword: { label: "Keyword", cls: "bg-blue-900/40 border-blue-700/30 text-blue-300" },
    ai:      { label: "AI",      cls: "bg-purple-900/40 border-purple-700/30 text-purple-300" },
    none:    { label: "No Reply", cls: "bg-white/5 border-white/10 text-slate-500" },
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-5 w-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Messages</h1>
          </div>
          <p className="text-sm text-slate-400">Incoming WhatsApp messages — auto-refreshes every 10s</p>
        </div>
        <button onClick={fetchMessages} className="btn-ghost">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && messages.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-16 flex flex-col items-center text-center">
          <MessageSquare className="h-8 w-8 text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-400">No messages yet</p>
          <p className="text-xs text-slate-600 mt-1">Send a WhatsApp message to your connected number to see it here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const badge = replyBadge[msg.reply_type] || replyBadge.none;
            return (
              <div key={msg.id} className="glass rounded-2xl px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-300">
                      {shortJid(msg.sender_jid).slice(0, 2)}
                    </div>
                    <span className="text-xs font-semibold text-slate-300 font-mono">
                      +{shortJid(msg.sender_jid)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                      {msg.reply_type === "ai" && <Bot className="h-2.5 w-2.5" />}
                      {msg.reply_type === "keyword" && <Zap className="h-2.5 w-2.5" />}
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-slate-600">{formatTime(msg.created_at)}</span>
                  </div>
                </div>

                <p className="text-sm text-white mb-2">📨 {msg.message_text}</p>

                {msg.reply_sent && (
                  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-[11px] text-slate-500 mb-0.5">Bot replied:</p>
                    <p className="text-xs text-slate-300">🤖 {msg.reply_sent}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
