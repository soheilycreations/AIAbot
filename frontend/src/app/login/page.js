"use client";

import { useState } from "react";
import { Lock, LogIn, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const SHOP_ID = "shop_123";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get shop to check password
      const res = await fetch(`${BACKEND_URL}/api/shop/${SHOP_ID}`);
      const shop = await res.json();

      if (!shop.password_hash) {
        // No password set - first time login
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        // Set password
        const setRes = await fetch(`${BACKEND_URL}/api/settings/${SHOP_ID}/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: "",
            newPassword: password,
          }),
        });

        if (setRes.ok) {
          // Save token to localStorage
          localStorage.setItem("shopToken", btoa(password));
          router.push("/dashboard");
        }
      } else {
        // Verify password
        const verifyRes = await fetch(`${BACKEND_URL}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: SHOP_ID,
            password: password,
          }),
        });

        if (verifyRes.ok) {
          localStorage.setItem("shopToken", btoa(password));
          router.push("/dashboard");
        } else {
          setError("❌ Wrong password");
        }
      }
    } catch (err) {
      setError("❌ Error: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">BotHive</h1>
          <p className="text-sm text-slate-400 mt-1">WhatsApp Bot Platform</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="glass rounded-2xl p-6 border border-purple-700/30">
          <h2 className="text-lg font-bold text-white mb-4">Login to Dashboard</h2>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-700/30 px-4 py-3 mb-4 flex items-center gap-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-400 mb-2 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              First time? Set your password (min 6 characters)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white transition-all"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Logging in…" : "Login"}
          </button>

          <p className="text-xs text-slate-500 text-center mt-4">
            🔒 Your password is stored securely with bcrypt encryption
          </p>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-600">
          <p>Soheily Creations © 2026</p>
          <p className="mt-1">"Build Smart · Grow Fast"</p>
        </div>
      </div>
    </div>
  );
}
