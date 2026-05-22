"use client";

import { useState, useEffect } from "react";
import { BarChart3, MessageSquare, Users, TrendingUp, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const SHOP_ID = "shop_123";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    today_messages: 0,
    week_messages: 0,
    active_customers: 0,
    reply_rate: 0,
    top_questions: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats/${SHOP_ID}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Stats error:", err);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="text-center py-16 text-slate-500">Loading stats…</div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 w-full">
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time WhatsApp bot performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="glass rounded-2xl p-5 border border-purple-700/30 hover:border-purple-600/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <span className="text-xs font-bold text-purple-400 bg-purple-900/40 px-2 py-1 rounded-full">
              Today
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.today_messages}</div>
          <p className="text-xs text-slate-500 mt-1">messages received</p>
        </div>

        <div className="glass rounded-2xl p-5 border border-blue-700/30 hover:border-blue-600/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <span className="text-xs font-bold text-blue-400 bg-blue-900/40 px-2 py-1 rounded-full">
              7 days
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.week_messages}</div>
          <p className="text-xs text-slate-500 mt-1">total messages</p>
        </div>

        <div className="glass rounded-2xl p-5 border border-green-700/30 hover:border-green-600/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-green-400" />
            <span className="text-xs font-bold text-green-400 bg-green-900/40 px-2 py-1 rounded-full">
              Active
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.active_customers}</div>
          <p className="text-xs text-slate-500 mt-1">unique customers</p>
        </div>

        <div className="glass rounded-2xl p-5 border border-orange-700/30 hover:border-orange-600/50 transition-all md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 bg-orange-900/40 px-2 py-1 rounded-full">
              Performance
            </span>
          </div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-bold text-white">{stats.reply_rate}%</div>
            <div className="text-xs text-slate-500 pb-1">of messages got replies</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border border-slate-700/30">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          Most Asked Words
        </h2>

        {stats.top_questions?.length > 0 ? (
          <div className="space-y-3">
            {stats.top_questions.map((q, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-medium text-white">{i + 1}. {q.word}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{
                        width: `${Math.min((q.count / (stats.top_questions[0]?.count || 1)) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-slate-400 w-8 text-right">{q.count}x</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No messages yet</p>
        )}
      </div>

      <div className="mt-6 glass rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-600">
        <span>Auto-refreshes every 30 seconds</span>
        <button onClick={fetchStats} className="text-slate-400 hover:text-slate-300">
          Refresh now
        </button>
      </div>
    </div>
  );
}
