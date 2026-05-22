"use client";

/**
 * /dashboard/connect
 *
 * The "Connect Bot" page.  Manages a Socket.io connection to the backend,
 * displays the Baileys QR code, and reflects the current WhatsApp
 * connection state to the user.
 */

import { QRCodeSVG } from "qrcode.react";
import { Bot, RefreshCw, WifiOff, Wifi, Info } from "lucide-react";
import { useWhatsAppSocket } from "@/hooks/useWhatsAppSocket";
import { StatusBadge } from "@/components/StatusBadge";
import { QRDisplay } from "@/components/QRDisplay";

// Hardcoded for the PoC — in production this comes from the auth session / DB
const SHOP_ID = "shop_123";

export default function ConnectBotPage() {
  const { status, qrCode, errorMsg, connect, disconnect } =
    useWhatsAppSocket(SHOP_ID);

  const isActive = status !== "idle" && status !== "disconnected" && status !== "error";

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-5 w-5 text-brand-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Connect Bot</h1>
        </div>
        <p className="text-sm text-slate-400">
          Link a WhatsApp number to{" "}
          <code className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] font-mono text-slate-300">
            {SHOP_ID}
          </code>
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-6">
        {/* ── Status card ───────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: "80ms" }}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Connection Status
              </p>
              <StatusBadge status={status} />
            </div>

            {/* Action button */}
            {isActive ? (
              <button
                onClick={disconnect}
                className="btn-ghost text-red-400 hover:bg-red-950/40 hover:text-red-300"
              >
                <WifiOff className="h-4 w-4" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={status === "connecting"}
                className="btn-primary"
              >
                <Wifi className="h-4 w-4" />
                {status === "idle" ? "Generate QR Code" : "Retry"}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/8 mb-5" />

          {/* QR / status display */}
          <div className="flex items-center justify-center min-h-[280px]">
            <QRDisplay status={status} qrCode={qrCode} />
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-orange-950/40 border border-orange-800/30 px-4 py-3 text-xs text-orange-300">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>

        {/* ── Instructions panel ────────────────────────────────────────────── */}
        <div
          className="glass rounded-2xl p-5 w-56 animate-fade-in self-start"
          style={{ animationDelay: "160ms" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            How to connect
          </p>
          <ol className="space-y-4">
            {[
              {
                step: "1",
                title: "Generate QR",
                desc: 'Click the "Generate QR Code" button to start a session.',
              },
              {
                step: "2",
                title: "Open WhatsApp",
                desc: "On your phone, go to Settings → Linked Devices.",
              },
              {
                step: "3",
                title: "Link a Device",
                desc: "Tap 'Link a Device' and scan the QR code shown.",
              },
              {
                step: "4",
                title: "You're live!",
                desc: "Your bot will start receiving messages automatically.",
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600/20 border border-brand-700/40 text-[10px] font-bold text-brand-400">
                  {step}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-300">{title}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Technical info (helpful for PoC demo) ───────────────────────────── */}
      <div
        className="mt-4 glass rounded-2xl px-5 py-4 animate-fade-in"
        style={{ animationDelay: "240ms" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-2">
          PoC Debug Info
        </p>
        <div className="flex items-center gap-6 text-xs text-slate-600 font-mono">
          <span>shopId: <span className="text-slate-400">shop_123</span></span>
          <span>socket: <span className="text-slate-400">{status}</span></span>
          <span>qr: <span className="text-slate-400">{qrCode ? "received" : "none"}</span></span>
          <span>
            backend:{" "}
            <span className="text-slate-400">
              {process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
