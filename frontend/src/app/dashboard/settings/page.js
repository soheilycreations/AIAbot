"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Key, LogOut, MapPin, Phone, Clock, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const SHOP_ID = "shop_123";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    shop_name: "",
    location: "",
    address: "",
    working_hours: "",
    contact_numbers: [],
  });

  const [password, setPassword] = useState({ current: "", new: "", confirm: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [contactInput, setContactInput] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const res = await fetch(`${BACKEND_URL}/api/settings/${SHOP_ID}`);
    const data = await res.json();
    setSettings(data);
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    const res = await fetch(`${BACKEND_URL}/api/settings/${SHOP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "✅ Settings saved successfully!" });
    } else {
      setMessage({ type: "error", text: "❌ Failed to save settings" });
    }
    setSaving(false);
  }

  async function changePassword() {
    if (!password.new || password.new.length < 6) {
      setMessage({ type: "error", text: "❌ Password must be at least 6 characters" });
      return;
    }

    if (password.new !== password.confirm) {
      setMessage({ type: "error", text: "❌ Passwords don't match" });
      return;
    }

    setSaving(true);
    const res = await fetch(`${BACKEND_URL}/api/settings/${SHOP_ID}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: password.current,
        newPassword: password.new,
      }),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "✅ Password changed successfully!" });
      setPassword({ current: "", new: "", confirm: "" });
    } else {
      const error = await res.json();
      setMessage({ type: "error", text: `❌ ${error.error}` });
    }
    setSaving(false);
  }

  function addContact() {
    if (contactInput.trim() && !settings.contact_numbers.includes(contactInput)) {
      setSettings({
        ...settings,
        contact_numbers: [...settings.contact_numbers, contactInput],
      });
      setContactInput("");
    }
  }

  function removeContact(index) {
    setSettings({
      ...settings,
      contact_numbers: settings.contact_numbers.filter((_, i) => i !== index),
    });
  }

  async function disconnectWhatsApp() {
    if (!confirm("Are you sure? You'll need to scan QR code again to reconnect.")) return;

    const res = await fetch(`${BACKEND_URL}/api/shop/${SHOP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp_connected: false }),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "✅ WhatsApp disconnected. Go to Connect Bot to reconnect." });
    }
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <Settings className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-400">Manage your shop & account</p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-sm
            ${
              message.type === "success"
                ? "bg-green-900/30 border border-green-700/30 text-green-300"
                : "bg-red-900/30 border border-red-700/30 text-red-300"
            }`}
        >
          <AlertCircle className="h-4 w-4" />
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading settings…</div>
      ) : (
        <>
          <div className="glass rounded-2xl p-6 mb-6 border border-blue-700/30">
            <h2 className="text-lg font-bold text-white mb-4">Shop Details</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block">Shop Name</label>
                <input
                  value={settings.shop_name || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, shop_name: e.target.value })
                  }
                  placeholder="My Shop"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Location/City
                </label>
                <input
                  value={settings.location || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, location: e.target.value })
                  }
                  placeholder="e.g. Colombo, Kandy"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block">Full Address</label>
                <textarea
                  value={settings.address || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, address: e.target.value })
                  }
                  placeholder="123 Main St, City, Country"
                  rows={2}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Working Hours
                </label>
                <input
                  value={settings.working_hours || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, working_hours: e.target.value })
                  }
                  placeholder="e.g. 9:00 AM - 6:00 PM (Mon-Fri)"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-2 block flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  Contact Numbers
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={contactInput}
                    onChange={(e) => setContactInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") addContact();
                    }}
                    placeholder="+94712345678"
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    onClick={addContact}
                    className="rounded-xl bg-blue-600/30 border border-blue-500/40 px-4 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-600/40 transition-all"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {settings.contact_numbers?.map((num, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 border border-blue-700/30 px-3 py-1 text-xs text-blue-300"
                    >
                      {num}
                      <button
                        onClick={() => removeContact(i)}
                        className="text-blue-400 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="btn-primary w-full mt-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 mb-6 border border-orange-700/30">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Key className="h-5 w-5 text-orange-400" />
              Security
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Current Password</label>
                <input
                  type="password"
                  value={password.current}
                  onChange={(e) =>
                    setPassword({ ...password, current: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">New Password</label>
                <input
                  type="password"
                  value={password.new}
                  onChange={(e) =>
                    setPassword({ ...password, new: e.target.value })
                  }
                  placeholder="Min. 6 characters"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  value={password.confirm}
                  onChange={(e) =>
                    setPassword({ ...password, confirm: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <button
                onClick={changePassword}
                disabled={saving}
                className="btn-primary w-full"
              >
                <Key className="h-4 w-4" />
                {saving ? "Updating…" : "Change Password"}
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-red-700/30">
            <h2 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h2>

            <button
              onClick={disconnectWhatsApp}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-900/30 border border-red-700/30 hover:bg-red-900/50 px-4 py-2.5 text-sm font-medium text-red-300 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Disconnect WhatsApp
            </button>
            <p className="text-xs text-slate-500 mt-2">
              This will disconnect your WhatsApp session. You'll need to scan QR code again.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
